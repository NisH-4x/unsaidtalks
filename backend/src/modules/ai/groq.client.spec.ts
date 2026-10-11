import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { EnvironmentVariables } from '../../config/env.validation';
import { GroqClient, GroqError } from './groq.client';

// Retries wait no time in tests.
class ImpatientClient extends GroqClient {
  protected override readonly retryDelayMs = 0;
}

function clientWith(apiKey: string | undefined) {
  const values: Record<string, unknown> = { GROQ_API_KEY: apiKey, GROQ_MODEL: 'groq-test' };
  const config = { get: (name: string) => values[name] } as ConfigService<
    EnvironmentVariables,
    true
  >;
  return new ImpatientClient(config);
}

const request = { systemInstruction: 'Summarise', prompt: 'Doubts…', schema: { type: 'object' } };

const answer = (content: string | null, finishReason = 'stop') => ({
  choices: [{ finish_reason: finishReason, message: { content } }],
});

const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Every call gets a fresh response (a body can be read only once), and counts start at zero. */
function respond(status: number, body: object) {
  const fetchMock = jest.spyOn(global, 'fetch');
  fetchMock.mockReset();
  return fetchMock.mockImplementation(() => Promise.resolve(reply(status, body)));
}

describe('GroqClient', () => {
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('is off without a key or with the placeholder from .env.example', async () => {
    expect(clientWith(undefined).isConfigured()).toBe(false);
    expect(clientWith('<your-groq-api-key>').isConfigured()).toBe(false);
    await expect(clientWith('').generateJson(request)).rejects.toEqual(
      new GroqError('not-configured'),
    );
  });

  it('sends the key in a header, never in the URL, and asks for schema-checked JSON', async () => {
    const fetchMock = respond(200, answer('{"overview":"ok","topics":[]}'));

    await expect(clientWith('secret-key').generateJson(request)).resolves.toEqual({
      overview: 'ok',
      topics: [],
    });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('secret-key');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'groq-test',
      response_format: {
        type: 'json_schema',
        json_schema: { strict: true, schema: request.schema },
      },
    });
  });

  it('tries again when the service is briefly over capacity', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(reply(503, { error: { type: 'service_unavailable' } }))
      .mockResolvedValueOnce(reply(200, answer('{"overview":"ok"}')));

    await expect(clientWith('secret-key').generateJson(request)).resolves.toEqual({
      overview: 'ok',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports rate limits, provider errors and unusable answers without inventing anything', async () => {
    const client = clientWith('secret-key');

    respond(429, { error: { code: 'rate_limit_exceeded' } });
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('rate-limited'));

    const overloaded = respond(503, { error: { type: 'service_unavailable' } });
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('unavailable'));
    expect(overloaded).toHaveBeenCalledTimes(3);

    respond(401, { error: { code: 'invalid_api_key' } });
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('unavailable'));

    respond(400, { error: { code: 'json_validate_failed' } });
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('invalid-response'));

    respond(200, answer(null, 'length'));
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('invalid-response'));

    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(client.generateJson(request)).rejects.toEqual(new GroqError('unavailable'));
  });
});
