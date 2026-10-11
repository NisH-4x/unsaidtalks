import { describe, expect, it } from 'vitest';
import { insertText } from './insertText';

describe('insertText', () => {
  it('inserts at the caret', () => {
    expect(insertText('See you', ' 👋', 7, 7, 100)).toEqual({ value: 'See you 👋', caret: 10 });
    expect(insertText('Thanks!', '🙏 ', 0, 0, 100)).toEqual({ value: '🙏 Thanks!', caret: 3 });
  });

  it('replaces selected text', () => {
    expect(insertText('I am happy today', '😊', 5, 10, 100)).toEqual({
      value: 'I am 😊 today',
      caret: 7,
    });
  });

  it('copes with a caret outside the text', () => {
    expect(insertText('Hi', '!', 99, 99, 100)).toEqual({ value: 'Hi!', caret: 3 });
    expect(insertText('Hi', '!', 2, 0, 100)).toEqual({ value: 'Hi!', caret: 3 });
  });

  it('refuses to go over the length limit', () => {
    expect(insertText('abc', '👍', 3, 3, 4)).toBeNull();
    expect(insertText('abc', '👍', 3, 3, 5)).toEqual({ value: 'abc👍', caret: 5 });
  });
});
