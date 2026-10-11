import { mongo } from 'mongoose';

const DUPLICATE_KEY_ERROR = 11000;

/** True when an insert or update was rejected by a unique index. */
export function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY_ERROR;
}
