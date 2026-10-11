import { execSync } from 'node:child_process';
import path from 'node:path';

/** Loads the sample data into the test database before the browser tests run. */
export default function globalSetup(): void {
  execSync('npm run seed', {
    cwd: path.resolve(import.meta.dirname, '../../backend'),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', MONGODB_DB_NAME: 'unsaidtalks_test' },
  });
}
