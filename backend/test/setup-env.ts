// Runs before every e2e test file. Values set here take precedence over backend/.env,
// so the tests use the same cluster but never the development database.
process.env.NODE_ENV = 'test';
process.env.MONGODB_DB_NAME = 'unsaidtalks_test';
