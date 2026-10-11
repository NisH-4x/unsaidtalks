import { parseWhatsAppExport, ParseOptions, privateSenderName } from './whatsapp-parser';

const IST = -330;
const options: ParseOptions = {
  timezoneOffsetMinutes: IST,
  now: new Date('2026-10-11T12:00:00Z'),
  maxTextLength: 4000,
};

describe('parseWhatsAppExport', () => {
  it('reads an Android export with 12-hour times, multi-line messages and notices', () => {
    const result = parseWhatsAppExport(
      [
        '12/10/2025, 7:45 pm - Messages and calls are end-to-end encrypted. Tap to learn more.',
        '12/10/2025, 7:46 pm - Priya Sharma: Welcome to the batch!',
        'Classes are on Mon, Wed and Fri.',
        '13/10/2025, 9:05 am - Rahul Verma: Thank you ma’am',
        '13/10/2025, 9:06 am - Rahul Verma: <Media omitted>',
        '13/10/2025, 9:07 am - Rahul Verma: This message was deleted',
      ].join('\n'),
      options,
    );

    expect(result.messages.map(({ sender, text }) => ({ sender, text }))).toEqual([
      { sender: 'Priya Sharma', text: 'Welcome to the batch!\nClasses are on Mon, Wed and Fri.' },
      { sender: 'Rahul Verma', text: 'Thank you ma’am' },
      { sender: 'Rahul Verma', text: '[Photo, video or file not included in the export]' },
    ]);
    // 7:46 pm in India is 14:16 UTC.
    expect(result.messages[0].sentAt.toISOString()).toBe('2025-10-12T14:16:00.000Z');
    expect(result).toMatchObject({
      dateOrder: 'day-first',
      dateOrderIsAmbiguous: false,
      skippedLines: 2,
    });
    expect(result.problems).toEqual([]);
  });

  it('reads an iPhone export with seconds, brackets and invisible direction marks', () => {
    const result = parseWhatsAppExport(
      [
        '\u200E[10/12/25, 19:45:12] Priya Sharma: \u200Eimage omitted',
        '[10/12/25, 19:46:01] Sneha Patel: Is the mock online?\u202F<This message was edited>',
      ].join('\n'),
      { ...options, timezoneOffsetMinutes: 0 },
    );

    expect(result.messages.map((m) => [m.sentAt.toISOString(), m.sender, m.text])).toEqual([
      [
        '2025-12-10T19:45:12.000Z',
        'Priya Sharma',
        '[Photo, video or file not included in the export]',
      ],
      ['2025-12-10T19:46:01.000Z', 'Sneha Patel', 'Is the mock online?'],
    ]);
    expect(result.dateOrderIsAmbiguous).toBe(true);
  });

  it('switches to month-first when a date only reads that way, unless told otherwise', () => {
    const lines = '10/25/2025, 8:00 AM - Aman Gupta: Hi\n10/26/2025, 8:00 AM - Aman Gupta: Hello';

    const detected = parseWhatsAppExport(lines, { ...options, timezoneOffsetMinutes: 0 });
    expect(detected.dateOrder).toBe('month-first');
    expect(detected.messages[0].sentAt.toISOString()).toBe('2025-10-25T08:00:00.000Z');

    const forced = parseWhatsAppExport(lines, { ...options, dateOrder: 'day-first' });
    expect(forced.messages).toEqual([]);
    expect(forced.problems).toEqual([
      { line: 1, reason: 'The date or time could not be read' },
      { line: 2, reason: 'The date or time could not be read' },
    ]);
  });

  it('handles midnight and noon in 12-hour times, and narrow spaces before am/pm', () => {
    const result = parseWhatsAppExport(
      '01/02/2025, 12:05\u202Fam - Neha: late\n01/02/2025, 12:05 p.m. - Neha: lunch',
      { ...options, timezoneOffsetMinutes: 0 },
    );
    expect(result.messages.map((m) => m.sentAt.toISOString())).toEqual([
      '2025-02-01T00:05:00.000Z',
      '2025-02-01T12:05:00.000Z',
    ]);
  });

  it('reports text before the first message, impossible dates and future dates', () => {
    const result = parseWhatsAppExport(
      [
        'Exported from WhatsApp',
        '31/02/2025, 10:00 - Rahul: impossible date',
        '01/01/2030, 10:00 - Rahul: from the future',
        '01/03/2025, 10:00 - Rahul: fine',
      ].join('\n'),
      options,
    );

    expect(result.messages.map((m) => m.text)).toEqual(['fine']);
    expect(result.problems).toEqual([
      { line: 1, reason: 'Text before the first dated message' },
      { line: 2, reason: 'The date or time could not be read' },
      { line: 3, reason: 'The date is in the future' },
    ]);
  });

  it('shortens messages that are longer than a message may be', () => {
    const result = parseWhatsAppExport(`01/03/2025, 10:00 - Rahul: ${'x'.repeat(50)}`, {
      ...options,
      maxTextLength: 10,
    });
    expect(result.messages[0].text).toBe('xxxxxxxxx…');
    expect(result.problems).toEqual([{ line: 1, reason: 'A very long message was shortened' }]);
  });
});

describe('privateSenderName', () => {
  it('keeps names but hides phone numbers apart from their last four digits', () => {
    expect(privateSenderName('Priya Sharma')).toBe('Priya Sharma');
    expect(privateSenderName('+91 98765 43210')).toBe('WhatsApp contact ending 3210');
    expect(privateSenderName('(555) 010-2299')).toBe('WhatsApp contact ending 2299');
    expect(privateSenderName('Batch 12')).toBe('Batch 12');
  });
});
