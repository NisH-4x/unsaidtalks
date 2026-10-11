import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/env.validation';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TIMEOUT_MS = 30_000;
/** Groq is sometimes briefly over capacity (503); a request is tried up to this many times. */
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

export type GroqFailure = 'not-configured' | 'rate-limited' | 'unavailable' | 'invalid-response';

export class GroqError extends Error {
  constructor(readonly failure: GroqFailure) {
    super(`Groq request failed: ${failure}`);
  }
}

export interface GroqJsonRequest {
  systemInstruction: string;
  prompt: string;
  /** JSON Schema the answer must follow (strict mode: every object closed, every field required). */
  schema: object;
}

interface ChatCompletionResponse {
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  error?: { code?: string; type?: string };
}

/**
 * Calls the Groq API from the server only. The key comes from GROQ_API_KEY and is sent in the
 * Authorization header, so it cannot end up in URLs, logs or error messages.
 */
@Injectable()
export class GroqClient {
  private readonly logger = new Logger(GroqClient.name);
  protected readonly retryDelayMs: number = 1_000;

  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  get model(): string {
    return this.config.get('GROQ_MODEL', { infer: true });
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey());
  }

  async generateJson<T>({ systemInstruction, prompt, schema }: GroqJsonRequest): Promise<T> {
    const key = this.apiKey();
    if (!key) throw new GroqError('not-configured');

    const request = JSON.stringify({
      model: this.model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'response', strict: true, schema },
      },
    });

    let body: ChatCompletionResponse;
    for (let attempt = 1; ; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
          body: request,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        this.logger.warn(`Groq request did not complete: ${(error as Error).name}`);
        throw new GroqError('unavailable');
      }

      body = (await response.json().catch(() => ({}))) as ChatCompletionResponse;
      if (response.ok) break;
      this.logger.warn(`Groq answered ${response.status} ${body.error?.code ?? ''}`.trim());
      if (response.status === 429) throw new GroqError('rate-limited');
      // The model's output did not match the schema.
      if (body.error?.code === 'json_validate_failed') throw new GroqError('invalid-response');
      if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_ATTEMPTS) {
        throw new GroqError('unavailable');
      }
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * attempt));
    }

    const choice = body.choices?.[0];
    try {
      return JSON.parse(choice?.message?.content ?? '') as T;
    } catch {
      this.logger.warn(`Groq returned no usable JSON (finish reason: ${choice?.finish_reason})`);
      throw new GroqError('invalid-response');
    }
  }

  private apiKey(): string | undefined {
    const key = this.config.get('GROQ_API_KEY', { infer: true })?.trim();
    return key && !key.startsWith('<') ? key : undefined;
  }
}
