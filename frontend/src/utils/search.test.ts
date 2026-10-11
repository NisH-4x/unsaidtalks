import { describe, expect, it } from 'vitest';
import { escapeRegExp, searchTerms } from './search';

describe('searchTerms', () => {
  it('splits a search into words without search operators', () => {
    expect(searchTerms('  mock  "test link" -spam a ')).toEqual(['mock', 'test', 'link', 'spam']);
  });
});

describe('escapeRegExp', () => {
  it('makes special characters literal', () => {
    expect(new RegExp(escapeRegExp('C++ (v2)?')).test('learning C++ (v2)? today')).toBe(true);
  });
});
