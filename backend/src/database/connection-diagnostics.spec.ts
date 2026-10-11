import {
  describeConnectionTarget,
  explainConnectionError,
  redactCredentials,
} from './connection-diagnostics';

describe('connection diagnostics', () => {
  it('redacts credentials embedded in a connection string', () => {
    const text = 'failed for mongodb+srv://app_user:p%40ss@cluster0.example.mongodb.net/db';

    expect(redactCredentials(text)).toBe(
      'failed for mongodb+srv://***@cluster0.example.mongodb.net/db',
    );
  });

  it('describes the target as host and database only', () => {
    const uri = 'mongodb+srv://app_user:secret@cluster0.example.mongodb.net/unsaidtalks?w=majority';

    expect(describeConnectionTarget(uri)).toBe('cluster0.example.mongodb.net/unsaidtalks');
  });

  it('explains authentication failures', () => {
    const error = new Error('bad auth : authentication failed');

    expect(explainConnectionError(error)).toMatch(/URL-encoded/);
  });

  it('points to the Atlas IP allowlist when the cluster is unreachable', () => {
    const error = new Error('Could not connect to any servers in your MongoDB Atlas cluster.');
    error.name = 'MongooseServerSelectionError';

    expect(explainConnectionError(error)).toMatch(/Network Access/);
  });

  it('never echoes credentials from unrecognised errors', () => {
    const error = new Error('unexpected failure at mongodb://app_user:secret@localhost:27017');

    expect(explainConnectionError(error)).not.toContain('secret');
  });
});
