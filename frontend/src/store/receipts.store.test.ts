import { beforeEach, describe, expect, it } from 'vitest';
import { isReadByEveryone, readStateOf } from '../utils/receipts';
import { useReceiptsStore } from './receipts.store';

const positions = () => useReceiptsStore.getState().positions.c1;

beforeEach(() => useReceiptsStore.getState().reset());

describe('receipts store', () => {
  it('only ever moves a read position forward', () => {
    const { setMembers, apply } = useReceiptsStore.getState();
    setMembers('c1', [
      { id: 'rahul', lastReadMessageId: 'a2' },
      { id: 'sneha', lastReadMessageId: null },
    ]);

    apply('c1', 'rahul', 'a5');
    apply('c1', 'rahul', 'a3');
    setMembers('c1', [{ id: 'rahul', lastReadMessageId: 'a4' }]);

    expect(positions().rahul).toBe('a5');
  });
});

describe('readStateOf', () => {
  const message = {
    id: 'a4',
    sender: { id: 'priya', name: 'Priya Sharma', role: 'mentor' as const },
  };

  it('counts the members other than the sender who have read up to the message', () => {
    const state = readStateOf(message, ['priya', 'rahul', 'sneha'], {
      priya: 'a1',
      rahul: 'a4',
      sneha: 'a3',
    });

    expect(state).toEqual({ readerIds: ['rahul'], audienceIds: ['rahul', 'sneha'] });
    expect(isReadByEveryone(state)).toBe(false);
    expect(isReadByEveryone(readStateOf(message, ['priya', 'rahul'], { rahul: 'a9' }))).toBe(true);
  });
});
