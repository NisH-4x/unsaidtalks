import { IsMongoId } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export class ConversationRefDto {
  @IsMongoId()
  conversationId: string;
}

/**
 * Validates a socket payload with the same class-validator rules used for HTTP bodies,
 * returning an error message instead of throwing so it can be sent back in the ack.
 */
export function parsePayload<T extends object>(
  dto: new () => T,
  payload: unknown,
): { value: T } | { error: string } {
  if (typeof payload !== 'object' || payload === null) return { error: 'Invalid request' };

  const value = plainToInstance(dto, payload);
  const [firstError] = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
  if (firstError) {
    return { error: Object.values(firstError.constraints ?? {})[0] ?? 'Invalid request' };
  }
  return { value };
}
