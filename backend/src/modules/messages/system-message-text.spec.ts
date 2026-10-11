import { describeMembersAdded } from './system-message-text';

describe('describeMembersAdded', () => {
  it.each([
    [['Priya'], 'Ananya added Priya'],
    [['Priya', 'Rahul'], 'Ananya added Priya and Rahul'],
    [['Priya', 'Rahul', 'Sneha'], 'Ananya added Priya, Rahul and Sneha'],
    [['Priya', 'Rahul', 'Sneha', 'Aman', 'Ishita'], 'Ananya added Priya, Rahul and 3 others'],
  ])('describes %j', (names, expected) => {
    expect(describeMembersAdded('Ananya', names)).toBe(expected);
  });
});
