import { describe, expect, it } from 'vitest';
import { describeTyping } from './presenceText';
import { formatLastSeen } from './time';

const typist = (name: string) => ({ userId: name, name });

describe('describeTyping', () => {
  it('says nothing when nobody is typing', () => {
    expect(describeTyping([], true)).toBeNull();
  });

  it('keeps private chats short', () => {
    expect(describeTyping([typist('Priya Sharma')], false)).toBe('typing…');
  });

  it('names up to two people in a group, then counts', () => {
    expect(describeTyping([typist('Priya Sharma')], true)).toBe('Priya is typing…');
    expect(describeTyping([typist('Priya Sharma'), typist('Arjun Mehta')], true)).toBe(
      'Priya and Arjun are typing…',
    );
    expect(
      describeTyping([typist('Priya Sharma'), typist('Arjun Mehta'), typist('Kavya Iyer')], true),
    ).toBe('3 people are typing…');
  });
});

describe('formatLastSeen', () => {
  const now = new Date(2026, 9, 11, 15, 0);

  it('describes today, yesterday and older dates', () => {
    expect(formatLastSeen(new Date(2026, 9, 11, 9, 5), now)).toMatch(/^last seen today at 9:05/);
    expect(formatLastSeen(new Date(2026, 9, 10, 20, 30), now)).toMatch(
      /^last seen yesterday at 8:30/,
    );
    expect(formatLastSeen(new Date(2026, 9, 2, 10, 0), now)).toBe('last seen on 2 Oct');
  });
});
