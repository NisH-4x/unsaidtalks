import { REACTION_EMOJIS } from '../../modules/messages/schemas/message.schema';
import { UserRole } from '../../modules/users/schemas/user.schema';

export const DEMO_PASSWORD = 'Demo@1234';

export const SEED_USERS = [
  { key: 'admin', name: 'Ananya Rao', email: 'admin@demo.test', role: 'admin' },
  { key: 'priya', name: 'Priya Sharma', email: 'priya@demo.test', role: 'mentor' },
  { key: 'arjun', name: 'Arjun Mehta', email: 'arjun@demo.test', role: 'mentor' },
  { key: 'kavya', name: 'Kavya Iyer', email: 'kavya@demo.test', role: 'mentor' },
  { key: 'rahul', name: 'Rahul Verma', email: 'rahul@demo.test', role: 'mentee' },
  { key: 'sneha', name: 'Sneha Patel', email: 'sneha@demo.test', role: 'mentee' },
  { key: 'aman', name: 'Aman Gupta', email: 'aman@demo.test', role: 'mentee' },
  { key: 'ishita', name: 'Ishita Singh', email: 'ishita@demo.test', role: 'mentee' },
  { key: 'rohan', name: 'Rohan Das', email: 'rohan@demo.test', role: 'mentee' },
  { key: 'meera', name: 'Meera Nair', email: 'meera@demo.test', role: 'mentee' },
  { key: 'vikram', name: 'Vikram Joshi', email: 'vikram@demo.test', role: 'mentee' },
  { key: 'neha', name: 'Neha Kulkarni', email: 'neha@demo.test', role: 'mentee' },
] as const satisfies readonly { key: string; name: string; email: string; role: UserRole }[];

export type SeedUserKey = (typeof SEED_USERS)[number]['key'];

/** Mentor signups waiting for admin approval. They cannot sign in or join conversations yet. */
export const SEED_MENTOR_APPLICANTS = [
  { name: 'Karan Malhotra', email: 'karan@demo.test' },
  { name: 'Divya Menon', email: 'divya@demo.test' },
] as const;

/** Time since the previous message in the conversation, e.g. '3m', '2h', '1d'. */
export type Gap = `${number}${'m' | 'h' | 'd'}`;

export interface SeedMessage {
  /** Local name used to point replies and reports at this message. */
  key?: string;
  from: SeedUserKey;
  text: string;
  after?: Gap;
  replyTo?: string;
  announcement?: boolean;
  pinned?: boolean;
  /** A resolved doubt must have a reply from a mentor; that reply resolves it. */
  doubt?: 'open' | 'resolved';
  deleted?: boolean;
  system?: boolean;
  /** An image or PDF from ./assets shared with this message; `text` becomes its caption. */
  attachment?: string;
  reactions?: Partial<Record<(typeof REACTION_EMOJIS)[number], SeedUserKey[]>>;
}

interface SeedConversationBase {
  /** How long ago the newest message was sent. */
  endsAgo: Gap;
  /** Number of trailing messages from others that each member has not read yet. */
  unread?: Partial<Record<SeedUserKey, number>>;
  messages: SeedMessage[];
}

export interface SeedGroup extends SeedConversationBase {
  name: string;
  program: string;
  batch: string;
  description: string;
  mentors: SeedUserKey[];
  mentees: SeedUserKey[];
  allowMenteeDirectChat?: boolean;
}

export interface SeedDirectChat extends SeedConversationBase {
  participants: [SeedUserKey, SeedUserKey];
}

export interface SeedReport {
  message: string;
  by: SeedUserKey;
  reason: 'spam' | 'abuse' | 'personal_info' | 'other';
  note: string;
}

export const SEED_GROUPS: SeedGroup[] = [
  {
    name: 'TCS NQT Prep – Batch 12',
    program: 'TCS NQT Prep',
    batch: 'Batch 12',
    description:
      'Daily aptitude practice, coding rounds and weekly mock tests for the TCS National Qualifier Test.',
    mentors: ['priya', 'arjun'],
    mentees: ['rahul', 'sneha', 'aman', 'ishita', 'rohan'],
    endsAgo: '35m',
    unread: { rahul: 3, sneha: 2, aman: 6 },
    messages: [
      {
        key: 'welcome',
        from: 'priya',
        after: '5m',
        announcement: true,
        pinned: true,
        reactions: { '👍': ['rahul', 'sneha', 'aman'], '🎉': ['ishita'] },
        text: 'Welcome to TCS NQT Prep – Batch 12! 🎯\nSchedule: Mon/Wed/Fri 7–8 PM live aptitude, Tue/Thu 7–8 PM coding, Saturday 10 AM full mock test.\nPost your questions here and use "Ask as doubt" so we can track them.',
      },
      {
        from: 'arjun',
        text: "Hi everyone, I'm Arjun. I'll be handling the coding section: arrays, strings and the two coding questions in the Advanced section.",
      },
      { from: 'rahul', text: 'Hello sir! Excited to start 🙌' },
      {
        key: 'pattern-question',
        from: 'sneha',
        text: "Hi all, I'm from the ECE 2026 batch. Is the NQT pattern still Foundation + Advanced?",
      },
      {
        from: 'priya',
        replyTo: 'pattern-question',
        text: 'Yes. Foundation covers numerical, verbal and reasoning ability. Advanced has advanced quant and reasoning plus 2 coding questions. Clearing Advanced makes you eligible for Digital and Prime roles.',
      },
      { key: 'cutoff-question', from: 'aman', text: "Ma'am, what's the cutoff usually?" },
      {
        from: 'priya',
        replyTo: 'cutoff-question',
        text: "TCS doesn't publish an official cutoff. Aim for 70%+ accuracy in Foundation and at least one fully correct coding solution.",
      },
      {
        key: 'resources',
        from: 'priya',
        after: '10m',
        pinned: true,
        text: '📚 Resources\nFormula sheet: https://example.com/nqt/formula-sheet\nPrevious year questions: https://example.com/nqt/pyq\nCoding practice set: https://example.com/nqt/coding-set-1',
      },
      {
        from: 'priya',
        after: '1d',
        text: "Today's live class: Time & Work and Pipes & Cisterns. Please join 5 minutes early.",
      },
      {
        key: 'time-work-doubt',
        from: 'ishita',
        after: '2h',
        doubt: 'resolved',
        text: "A finishes a job in 12 days and B in 18 days. They work on alternate days starting with A. I'm getting 14.5 days but the answer key says 14⅓. Where am I going wrong?",
      },
      {
        key: 'time-work-answer',
        from: 'priya',
        replyTo: 'time-work-doubt',
        text: "Every 2 days they finish 1/12 + 1/18 = 5/36. After 14 days that's 35/36. Day 15 is A's turn: the remaining 1/36 at 1/12 per day takes 1/3 of a day. So 14⅓ days.",
      },
      {
        from: 'ishita',
        replyTo: 'time-work-answer',
        text: "Got it! I was counting a full extra day for A at the end. Thanks ma'am 🙏",
      },
      {
        key: 'recording-question',
        from: 'rohan',
        after: '40m',
        text: 'Is the class recording available? I had a college lab till 8.',
      },
      {
        from: 'arjun',
        replyTo: 'recording-question',
        text: 'Recordings go up within 24 hours in the Resources link pinned above.',
      },
      {
        from: 'arjun',
        after: '1d',
        announcement: true,
        text: "Coding practice tonight at 7 PM: two-pointer technique. Try 'Pair with given sum' before class so we can compare approaches.",
      },
      {
        from: 'aman',
        after: '30m',
        doubt: 'open',
        text: 'For the coding section, can we use Python, or is C++/Java better? Python feels slow for large inputs.',
      },
      { from: 'sneha', text: "Same question, I'm most comfortable in Python 😅" },
      {
        key: 'pair-sum-doubt',
        from: 'rahul',
        after: '3h',
        doubt: 'resolved',
        text: 'In the pair sum problem, does sorting + two pointers still work if I have to return the original indices?',
      },
      {
        key: 'pair-sum-answer',
        from: 'arjun',
        replyTo: 'pair-sum-doubt',
        text: "Sorting loses the original positions. Either sort (value, index) pairs, or use a hash map in one pass: for each value, check whether target − value is already in the map, then store the value's index.",
      },
      {
        from: 'rahul',
        replyTo: 'pair-sum-answer',
        text: 'The hash map version passed all test cases. Thanks sir!',
      },
      {
        from: 'priya',
        after: '2h',
        text: 'Reminder: the Saturday mock test is 90 minutes with no negative marking. Keep a rough sheet ready.',
      },
      {
        key: 'seating-doubt',
        from: 'sneha',
        after: '1d',
        doubt: 'open',
        text: 'Seating arrangement questions take me 5+ minutes each. Any strategy to speed up?',
      },
      {
        key: 'seating-tip',
        from: 'ishita',
        replyTo: 'seating-doubt',
        text: 'Draw the arrangement first and fill in the fixed positions before anything else. It helped me a lot.',
      },
      { from: 'sneha', replyTo: 'seating-tip', text: 'Will try that, thanks Ishita!' },
      { from: 'rohan', after: '15m', deleted: true, text: 'Wrong group, sorry' },
      {
        from: 'priya',
        after: '4h',
        announcement: true,
        text: 'Mock Test 1 results are out. Batch average: 62%. Top scorers: Ishita (84%) and Rahul (79%). Detailed solutions are in the Resources link.',
      },
      { from: 'rahul', text: 'Yay! 🎉' },
      {
        key: 'low-score',
        from: 'aman',
        after: '10m',
        text: 'Got 58%... the quant section pulled me down.',
      },
      {
        from: 'priya',
        replyTo: 'low-score',
        text: "That's a good baseline, Aman. Focus on percentages and ratios this week; they were 30% of the quant section.",
      },
      {
        key: 'rude-comment',
        from: 'rohan',
        after: '5m',
        text: 'lol 58 in this test? only careless people score that low',
      },
      {
        from: 'rohan',
        after: '20h',
        doubt: 'open',
        text: 'Profit & loss: if the marked price is 25% above cost and the discount is 10%, the profit is 12.5%, right?',
      },
      {
        from: 'arjun',
        after: '1h',
        text: 'Coding tip of the day: read the input format carefully. Many submissions fail because of trailing spaces or reading input line by line incorrectly.',
      },
      {
        key: 'mock-link-question',
        from: 'ishita',
        after: '3h',
        text: "Can someone share the link for Saturday's mock test?",
      },
      {
        from: 'priya',
        replyTo: 'mock-link-question',
        text: "It'll be posted here on Saturday at 9:45 AM and pinned to the top.",
      },
      {
        from: 'arjun',
        after: '2h',
        text: "Tonight's class moves to 8 PM because of the campus placement drive. Same link as usual.",
      },
      { from: 'rahul', text: 'Okay sir 👍' },
      { from: 'sneha', after: '2m', text: 'Noted, thanks!' },
      {
        from: 'priya',
        after: '20m',
        text: 'Homework for tonight: 15 questions from the percentages section of the PYQ sheet.',
      },
      {
        from: 'ishita',
        after: '5m',
        text: 'Done with 10 already, these are fun once you see the pattern.',
      },
    ],
  },
  {
    name: 'Infosys SP & DSE – Batch 4',
    program: 'Infosys Specialist Programmer & DSE',
    batch: 'Batch 4',
    description:
      'Hands-on coding preparation for the Infosys Specialist Programmer and Digital Specialist Engineer roles.',
    mentors: ['kavya'],
    mentees: ['meera', 'vikram', 'neha', 'rahul'],
    endsAgo: '3h',
    unread: { meera: 2, rahul: 2 },
    messages: [
      {
        from: 'kavya',
        after: '5m',
        announcement: true,
        pinned: true,
        text: 'Welcome to Infosys SP & DSE – Batch 4! The test has 3 coding questions in 3 hours (easy, medium, hard). We will practise one hard problem every week. Live sessions: Tuesday and Friday, 8 PM.',
      },
      { key: 'language-question', from: 'meera', text: "Hi ma'am! Is Java okay for SP?" },
      {
        from: 'kavya',
        replyTo: 'language-question',
        text: 'Java, C++ and Python are all allowed. Pick the one you can debug fastest in.',
      },
      {
        key: 'role-doubt',
        from: 'vikram',
        after: '1h',
        doubt: 'resolved',
        text: 'What is the difference between the SP and DSE roles? Is the test different?',
      },
      {
        from: 'kavya',
        replyTo: 'role-doubt',
        text: "It's the same test. Your score decides the role: higher scores are offered Specialist Programmer, others are considered for Digital Specialist Engineer.",
      },
      { from: 'neha', text: "That's really helpful, thanks!" },
      {
        from: 'kavya',
        after: '1d',
        pinned: true,
        text: 'Weekly problem list: https://example.com/infosys/week-1\nFocus: dynamic programming (0/1 knapsack, longest increasing subsequence, coin change).',
      },
      {
        from: 'kavya',
        attachment: 'week-1-dp-practice-sheet.pdf',
        reactions: { '🙏': ['meera', 'vikram'], '👍': ['rahul'] },
        text: 'Practice sheet for this week, with hints at the end. Try each problem before reading its hint.',
      },
      {
        key: 'coin-change-doubt',
        from: 'rahul',
        after: '5h',
        doubt: 'open',
        text: "Coin change: I understand the recursion but can't convert it to bottom-up DP. Any tips?",
      },
      {
        from: 'meera',
        replyTo: 'coin-change-doubt',
        text: 'Try filling the table for amounts 0..N on paper first. It clicked for me that way.',
      },
      {
        from: 'kavya',
        text: "Good suggestion, Meera. Rahul, we'll walk through coin change step by step in Friday's session.",
      },
      {
        key: 'lis-doubt',
        from: 'vikram',
        after: '2h',
        doubt: 'resolved',
        attachment: 'lis-question.png',
        text: 'Problem 4 from the sheet: my DP is O(n²) and times out. How do I get O(n log n)?',
      },
      {
        from: 'kavya',
        replyTo: 'lis-doubt',
        text: 'Keep tails[k] = the smallest tail of an increasing subsequence of length k + 1. For each number, binary-search the first tail that is ≥ it and replace it, or append if there is none. The answer is the length of tails.',
      },
      {
        key: 'mcq-question',
        from: 'vikram',
        after: '1d',
        text: "Ma'am, are there any MCQ sections, or is it only coding?",
      },
      {
        from: 'kavya',
        replyTo: 'mcq-question',
        text: 'Only coding in the current pattern, but expect a technical interview on OOP, DBMS and operating systems afterwards.',
      },
      {
        from: 'neha',
        after: '30m',
        doubt: 'open',
        text: 'Which DBMS topics should we prioritise for the interview?',
      },
      {
        from: 'kavya',
        after: '3h',
        announcement: true,
        text: "Friday's session is a 2-hour mock: one medium and one hard problem. Join from a laptop with your IDE ready.",
      },
      { from: 'meera', text: 'Ready! 💪' },
      {
        key: 'recording-question',
        from: 'vikram',
        after: '10m',
        text: 'Will the mock be recorded?',
      },
      {
        from: 'kavya',
        replyTo: 'recording-question',
        text: 'Yes, the recording and an editorial will be shared after the session.',
      },
    ],
  },
  {
    name: 'Off-Campus Bootcamp – Batch 7',
    program: 'Off-Campus Placement Bootcamp',
    batch: 'Batch 7',
    description:
      'Resume reviews, outreach strategy and HR interview practice for off-campus hiring.',
    mentors: ['arjun', 'kavya'],
    mentees: ['sneha', 'aman', 'neha', 'vikram'],
    allowMenteeDirectChat: true,
    endsAgo: '1d',
    unread: { aman: 2, vikram: 4 },
    messages: [
      {
        from: 'arjun',
        after: '5m',
        announcement: true,
        pinned: true,
        text: 'Welcome to the Off-Campus Bootcamp! We will cover resume reviews, LinkedIn outreach and HR interview practice. Mentee-to-mentee chats are enabled in this group so you can pair up for mock interviews.',
      },
      {
        from: 'kavya',
        text: "Please share your resume as a PDF in this group by Sunday. We'll review a few live every Wednesday.",
      },
      {
        key: 'one-page-question',
        from: 'vikram',
        after: '1h',
        text: 'Does the resume need to be one page?',
      },
      {
        from: 'kavya',
        replyTo: 'one-page-question',
        text: 'For freshers, yes. Keep it to one page and put projects before extra-curriculars.',
      },
      {
        key: 'referral-spam',
        from: 'vikram',
        after: '6h',
        text: '🔥 Guaranteed referrals at top MNCs for just ₹999! DM me for my Telegram link 🔥',
      },
      {
        key: 'intro-doubt',
        from: 'sneha',
        after: '1d',
        doubt: 'resolved',
        text: "How do I answer 'Tell me about yourself' without just repeating my resume?",
      },
      {
        from: 'arjun',
        replyTo: 'intro-doubt',
        text: "Use present–past–future: what you're doing now, one or two experiences that shaped you, and why this role is the natural next step. Keep it under 90 seconds.",
      },
      {
        key: 'pairing-question',
        from: 'neha',
        after: '2h',
        text: 'Can we pair up for mock HR interviews this weekend? Anyone free on Saturday evening?',
      },
      {
        from: 'sneha',
        replyTo: 'pairing-question',
        text: "I'm in! Let's fix a time over a direct message.",
      },
      {
        from: 'aman',
        after: '1d',
        doubt: 'open',
        text: 'Is it okay to apply to roles that ask for 1 year of experience as a fresher?',
      },
      {
        from: 'arjun',
        after: '4h',
        announcement: true,
        text: "Wednesday resume review: we'll pick 5 resumes at random. Make sure yours is uploaded!",
      },
      {
        from: 'kavya',
        after: '1h',
        text: 'Tip: tailor your project bullet points to each job description and mirror the keywords they use.',
      },
      { from: 'neha', after: '20m', text: "Thanks ma'am, updating mine tonight." },
    ],
  },
];

export const SEED_DIRECT_CHATS: SeedDirectChat[] = [
  {
    participants: ['rahul', 'priya'],
    endsAgo: '2h',
    messages: [
      {
        from: 'rahul',
        text: "Hi ma'am, can I ask something about my mock test performance privately?",
      },
      { from: 'priya', after: '6m', text: 'Of course, Rahul.' },
      {
        from: 'rahul',
        text: "I'm consistently slow in the verbal section. I finish only 18 of 25 questions.",
      },
      {
        from: 'priya',
        after: '4m',
        text: 'Leave reading comprehension for last. Do the grammar and vocabulary questions first; they are quicker marks.',
      },
      { from: 'priya', text: 'Also practise one RC passage daily with a 6-minute timer.' },
      { from: 'rahul', after: '10m', text: "Will do. Thank you ma'am!" },
    ],
  },
  {
    participants: ['arjun', 'aman'],
    endsAgo: '50m',
    unread: { aman: 1 },
    messages: [
      {
        from: 'arjun',
        text: 'Hi Aman, I saw your mock score. Want to do a 20-minute call on quant strategy this week?',
      },
      { from: 'aman', after: '15m', text: 'Yes sir, that would help a lot!' },
      {
        from: 'arjun',
        after: '1h',
        text: "Does Thursday 6 PM work? I'll share the meeting link here.",
      },
    ],
  },
  {
    participants: ['sneha', 'neha'],
    endsAgo: '20m',
    unread: { sneha: 1 },
    messages: [
      { from: 'sneha', text: 'Hey Neha! Saturday 6 PM for the mock HR round?' },
      { from: 'neha', after: '8m', text: 'Perfect. You interview me first, then we switch 😄' },
      { from: 'sneha', after: '3m', text: "Deal. I'll prepare 5 common HR questions." },
      { from: 'neha', after: '1h', text: "Great, I'll bring the behavioural ones." },
    ],
  },
];

export const SEED_REPORTS: SeedReport[] = [
  {
    message: 'referral-spam',
    by: 'neha',
    reason: 'spam',
    note: 'Selling referrals for money. Looks like a scam.',
  },
  {
    message: 'rude-comment',
    by: 'aman',
    reason: 'abuse',
    note: 'Mocking people who are struggling with the test.',
  },
];
