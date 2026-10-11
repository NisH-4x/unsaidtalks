import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { explainConnectionError } from '../connection-diagnostics';
import { DEMO_PASSWORD, SEED_MENTOR_APPLICANTS, SEED_USERS } from './seed-data';
import { SeedModule } from './seed.module';
import { SeedService } from './seed.service';

async function seed(): Promise<void> {
  console.log('Connecting to MongoDB...');
  const app = await NestFactory.createApplicationContext(SeedModule, {
    logger: false,
    abortOnError: false,
  });

  try {
    const seedService = app.get(SeedService);
    console.log('Seeding database...');

    const summary = await seedService.run();
    console.table(summary);

    const problems = await seedService.verify();
    if (problems.length > 0) {
      throw new Error(`Integrity checks failed:\n${problems.join('\n')}`);
    }
    console.log('Integrity checks passed.\n');

    console.log(`Sample accounts (password for all: ${DEMO_PASSWORD})`);
    console.table([
      ...SEED_USERS.map(({ name, email, role }) => ({ name, email, role, status: 'active' })),
      ...SEED_MENTOR_APPLICANTS.map(({ name, email }) => ({
        name,
        email,
        role: 'mentor',
        status: 'pending approval',
      })),
    ]);
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  console.error(`Seeding failed: ${explainConnectionError(error)}`);
  process.exitCode = 1;
});
