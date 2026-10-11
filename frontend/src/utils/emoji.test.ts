import { describe, expect, it } from 'vitest';
import { addRecentEmoji, EMOJI_CATEGORIES, searchEmoji } from './emoji';
import { EMOJI_NAMES } from './emojiNames';

describe('EMOJI_CATEGORIES', () => {
  it('lists every emoji once', () => {
    const all = EMOJI_CATEGORIES.flatMap((category) => category.emojis);
    expect(new Set(all).size).toBe(all.length);
    for (const category of EMOJI_CATEGORIES) expect(category.emojis.length).toBeGreaterThan(20);
  });

  it('keeps multi-part emoji such as ❤️ and 👩‍💻 whole', () => {
    const all = EMOJI_CATEGORIES.flatMap((category) => category.emojis);
    expect(all).toContain('❤️');
    expect(all).toContain('👩‍💻');
    expect(all).not.toContain('');
  });

  it('has search words for every emoji', () => {
    for (const emoji of EMOJI_CATEGORIES.flatMap((category) => category.emojis)) {
      expect(EMOJI_NAMES[emoji], emoji).toMatch(/^[a-z0-9 -]+$/);
    }
  });
});

describe('searchEmoji', () => {
  it('matches the start of name words, ignoring case', () => {
    expect(searchEmoji('fire')).toEqual(['🔥']);
    expect(searchEmoji('Thumbs')).toEqual(['👍', '👎']);
    expect(searchEmoji('laugh')).toEqual(expect.arrayContaining(['😂', '🤣', '😆']));
  });

  it('needs every word of the query', () => {
    expect(searchEmoji('raising both')).toEqual(['🙌']);
    expect(searchEmoji('red heart')).toEqual(['❤️']);
  });

  it('finds nothing for an empty or unknown query', () => {
    expect(searchEmoji('')).toEqual([]);
    expect(searchEmoji('   ')).toEqual([]);
    expect(searchEmoji('xylophone')).toEqual([]);
  });
});

describe('addRecentEmoji', () => {
  it('puts the newest first without duplicates', () => {
    expect(addRecentEmoji([], '👍')).toEqual(['👍']);
    expect(addRecentEmoji(['😂', '👍', '🙏'], '👍')).toEqual(['👍', '😂', '🙏']);
  });

  it('keeps at most 24', () => {
    const full = EMOJI_CATEGORIES[0].emojis.slice(0, 24);
    const updated = addRecentEmoji(full, '🎉');
    expect(updated).toHaveLength(24);
    expect(updated[0]).toBe('🎉');
    expect(updated).not.toContain(full[23]);
  });
});
