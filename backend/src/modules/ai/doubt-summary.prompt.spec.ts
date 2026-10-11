import {
  buildDoubtPrompt,
  DoubtForSummary,
  reconcileSummary,
  UNGROUPED_TITLE,
} from './doubt-summary.prompt';

const now = new Date('2026-10-11T12:00:00Z');

function doubt(ref: string, askedBy: string, text: string): DoubtForSummary {
  return {
    ref,
    messageId: `message-${ref}`,
    askedBy,
    askedAt: new Date('2026-10-09T10:00:00Z'),
    text,
    replies: [],
  };
}

describe('buildDoubtPrompt', () => {
  it('lists each doubt with its id, asker, age and replies', () => {
    const prompt = buildDoubtPrompt(
      'TCS NQT Prep',
      [
        {
          ...doubt('d1', 'Rahul Verma', 'Coin change bottom-up?'),
          replies: [{ author: 'Meera Nair', role: 'mentee', text: 'Fill the table on paper' }],
        },
      ],
      now,
    );

    expect(prompt).toContain('Group: TCS NQT Prep');
    expect(prompt).toContain('[d1] Rahul Verma, asked 2 days ago:');
    expect(prompt).toContain('"""Coin change bottom-up?"""');
    expect(prompt).toContain('Reply from Meera Nair (mentee): """Fill the table on paper"""');
  });
});

describe('reconcileSummary', () => {
  const doubts = [
    doubt('d1', 'Rahul Verma', 'LIS in n log n?'),
    doubt('d2', 'Sneha Patel', 'Seating arrangement tips?'),
    doubt('d3', 'Aman Gupta', 'LIS with binary search?'),
  ];

  it('keeps only real doubts, each once, and lists the ones the model left out', () => {
    const result = reconcileSummary(
      {
        overview: 'Two themes this week.',
        topics: [
          {
            title: 'Longest increasing subsequence',
            summary: 'Faster LIS.',
            doubtIds: ['d1', 'd3', 'd9'],
          },
          { title: 'Repeat', summary: 'Again', doubtIds: ['d1'] },
        ],
      },
      doubts,
    );

    expect(result?.overview).toBe('Two themes this week.');
    expect(result?.topics.map((t) => [t.title, t.doubts.map((d) => d.ref)])).toEqual([
      ['Longest increasing subsequence', ['d1', 'd3']],
      [UNGROUPED_TITLE, ['d2']],
    ]);
  });

  it('rejects an answer that is not a summary', () => {
    expect(reconcileSummary('not json', doubts)).toBeNull();
    expect(reconcileSummary({ overview: 'x' }, doubts)).toBeNull();
  });
});
