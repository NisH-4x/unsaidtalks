import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import mongoose from 'mongoose';
import { AppConfigModule } from '../../config/app-config.module';
import { EnvironmentVariables } from '../../config/env.validation';
import { describeConnectionTarget, explainConnectionError } from '../connection-diagnostics';

async function readDatabaseSettings(): Promise<{ uri: string; dbName?: string }> {
  const context = await NestFactory.createApplicationContext(AppConfigModule, {
    logger: false,
    abortOnError: false,
  });
  const config = context.get<ConfigService<EnvironmentVariables, true>>(ConfigService);
  const settings = {
    uri: config.get('MONGODB_URI', { infer: true }),
    dbName: config.get('MONGODB_DB_NAME', { infer: true }),
  };
  await context.close();
  return settings;
}

async function checkConnection(): Promise<void> {
  const { uri, dbName } = await readDatabaseSettings();
  console.log(`Connecting to ${describeConnectionTarget(uri)} ...`);

  const connection = mongoose.createConnection(uri, { dbName, serverSelectionTimeoutMS: 10_000 });
  try {
    await connection.asPromise();
    const db = connection.db;
    if (!db) throw new Error('Connected without a database handle');

    const pingStartedAt = Date.now();
    await db.admin().ping();
    const pingMs = Date.now() - pingStartedAt;

    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collections.map((collection) => collection.name).sort();

    console.log(`Connected to database "${db.databaseName}" (ping ${pingMs} ms).`);
    console.log(
      collectionNames.length > 0
        ? `Collections: ${collectionNames.join(', ')}`
        : 'The database is empty. Run "npm run seed" to load sample data.',
    );
  } finally {
    await connection.close();
  }
}

checkConnection().catch((error: unknown) => {
  console.error(`Database check failed: ${explainConnectionError(error)}`);
  process.exitCode = 1;
});
