import { randomBytes } from 'crypto';
import { Types } from 'mongoose';

/**
 * Message ids double as the timeline order (pagination sorts by _id), so imported history
 * gets ids whose timestamp is the original send time. WhatsApp exports often give only the
 * minute, so messages in the same second keep their file order through `sequence`.
 */
export function historicalIdFactory(): (sentAt: Date, sequence: number) => Types.ObjectId {
  const batch = randomBytes(5);
  return (sentAt, sequence) => {
    const bytes = Buffer.alloc(12);
    bytes.writeUInt32BE(Math.floor(sentAt.getTime() / 1000), 0);
    batch.copy(bytes, 4);
    bytes.writeUIntBE(sequence % 0x1000000, 9, 3);
    return new Types.ObjectId(bytes);
  };
}
