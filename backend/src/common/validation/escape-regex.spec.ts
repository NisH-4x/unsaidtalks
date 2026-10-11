import { escapeRegex } from './escape-regex';

describe('escapeRegex', () => {
  it('matches special characters literally', () => {
    const pattern = new RegExp(escapeRegex('a.b*(c)'));

    expect(pattern.test('a.b*(c)')).toBe(true);
    expect(pattern.test('axbbbc')).toBe(false);
  });
});
