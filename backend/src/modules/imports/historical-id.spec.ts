import { historicalIdFactory } from './historical-id';

describe('historicalIdFactory', () => {
  it('orders ids by original time, and by file order within the same second', () => {
    const idFor = historicalIdFactory();
    const minute = new Date('2025-10-12T14:16:00Z');

    const ids = [
      idFor(minute, 0),
      idFor(minute, 1),
      idFor(new Date('2025-10-12T14:17:00Z'), 2),
    ].map((id) => id.toHexString());

    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(3);
    expect(idFor(minute, 0).getTimestamp().toISOString()).toBe('2025-10-12T14:16:00.000Z');
  });
});
