export type DateOrder = 'day-first' | 'month-first';

export interface ParsedMessage {
  sentAt: Date;
  sender: string;
  text: string;
  /** Line number in the file where the message starts (1-based). */
  line: number;
}

export interface ParseProblem {
  line: number;
  reason: string;
}

export interface ParseResult {
  messages: ParsedMessage[];
  dateOrder: DateOrder;
  /** True when every date in the file reads correctly either way round (e.g. 05/06). */
  dateOrderIsAmbiguous: boolean;
  /** Notices without a sender ("Messages are end-to-end encrypted") and deleted messages. */
  skippedLines: number;
  problems: ParseProblem[];
}

export interface ParseOptions {
  /** Overrides the detected order of day and month. */
  dateOrder?: DateOrder;
  /** Minutes to add to the exported local times to reach UTC (Date#getTimezoneOffset). */
  timezoneOffsetMinutes: number;
  now: Date;
  maxTextLength: number;
}

const MEDIA_PLACEHOLDER = '[Photo, video or file not included in the export]';

// "12/10/26, 7:45 pm - Name: text" (Android) and "[12/10/26, 7:45:12 PM] Name: text" (iPhone).
const ANDROID_LINE =
  /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([ap]\.? ?m\.?)? [-–] (.*)$/i;
const IPHONE_LINE =
  /^\[(\d{1,2})[./-](\d{1,2})[./-](\d{2,4}),? (\d{1,2}):(\d{2})(?::(\d{2}))? ?([ap]\.? ?m\.?)?\] (.*)$/i;

const MEDIA_LINE =
  /^(<media omitted>|<attached: .*>|(image|video|audio|sticker|document|gif|contact card) omitted)$/i;
const DELETED_LINE = /^(this message was deleted|you deleted this message)$/i;
const EDITED_SUFFIX = / ?<this message was edited>$/i;
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

interface Header {
  first: number;
  second: number;
  year: number;
  hour: number;
  minute: number;
  secondOfMinute: number;
  meridiem: string | undefined;
  rest: string;
  line: number;
}

/** Removes the invisible direction marks and odd spaces that WhatsApp puts into exports. */
function normalise(content: string): string[] {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .split(/\r?\n/);
}

function readHeader(text: string, line: number): Header | null {
  const match = ANDROID_LINE.exec(text) ?? IPHONE_LINE.exec(text);
  if (!match) return null;
  const [, first, second, year, hour, minute, secondOfMinute, meridiem, rest] = match;
  return {
    first: Number(first),
    second: Number(second),
    year: year.length === 2 ? 2000 + Number(year) : Number(year),
    hour: Number(hour),
    minute: Number(minute),
    secondOfMinute: Number(secondOfMinute ?? 0),
    meridiem: meridiem?.replace(/[. ]/g, '').toLowerCase(),
    rest,
    line,
  };
}

/** Day-first unless a date only makes sense month-first (or the caller decides). */
function chooseDateOrder(headers: Header[]): { order: DateOrder; ambiguous: boolean } {
  const dayFirstOnly = headers.some((h) => h.first > 12);
  const monthFirstOnly = headers.some((h) => h.second > 12);
  if (monthFirstOnly && !dayFirstOnly) return { order: 'month-first', ambiguous: false };
  return { order: 'day-first', ambiguous: !dayFirstOnly && !monthFirstOnly };
}

function toDate(header: Header, order: DateOrder, timezoneOffsetMinutes: number): Date | null {
  const day = order === 'day-first' ? header.first : header.second;
  const month = order === 'day-first' ? header.second : header.first;
  let hour = header.hour;
  if (header.meridiem) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (header.meridiem.startsWith('p') ? 12 : 0);
  }
  if (month < 1 || month > 12 || day < 1 || hour > 23 || header.minute > 59) return null;

  const local = Date.UTC(header.year, month - 1, day, hour, header.minute, header.secondOfMinute);
  // Date.UTC rolls 31 February over into March; such a date is not valid.
  if (new Date(local).getUTCDate() !== day) return null;
  return new Date(local + timezoneOffsetMinutes * 60_000);
}

/** Splits "Name: text" into sender and text; lines without a sender are notices. */
function splitSender(rest: string): { sender: string; text: string } | null {
  const separator = rest.indexOf(': ');
  if (separator <= 0) return null;
  return { sender: rest.slice(0, separator).trim(), text: rest.slice(separator + 2) };
}

/** Reads a chat exported from WhatsApp ("Export chat", without media). */
export function parseWhatsAppExport(content: string, options: ParseOptions): ParseResult {
  const lines = normalise(content);
  const headers: Header[] = [];
  const bodies: string[][] = [];
  const problems: ParseProblem[] = [];

  lines.forEach((text, index) => {
    const header = readHeader(text, index + 1);
    if (header) {
      headers.push(header);
      bodies.push([]);
    } else if (bodies.length > 0) {
      bodies[bodies.length - 1].push(text);
    } else if (text.trim()) {
      problems.push({ line: index + 1, reason: 'Text before the first dated message' });
    }
  });

  const detected = chooseDateOrder(headers);
  const order = options.dateOrder ?? detected.order;
  const messages: ParsedMessage[] = [];
  let skippedLines = 0;

  headers.forEach((header, index) => {
    const sentAt = toDate(header, order, options.timezoneOffsetMinutes);
    if (!sentAt) {
      problems.push({ line: header.line, reason: 'The date or time could not be read' });
      return;
    }
    if (sentAt.getTime() > options.now.getTime() + FUTURE_TOLERANCE_MS) {
      problems.push({ line: header.line, reason: 'The date is in the future' });
      return;
    }

    const parts = splitSender(header.rest);
    if (!parts) {
      skippedLines += 1;
      return;
    }
    const body = [parts.text, ...bodies[index]].join('\n').replace(EDITED_SUFFIX, '').trim();
    if (DELETED_LINE.test(body)) {
      skippedLines += 1;
      return;
    }

    let text = MEDIA_LINE.test(body) ? MEDIA_PLACEHOLDER : body;
    if (!text) {
      skippedLines += 1;
      return;
    }
    if (text.length > options.maxTextLength) {
      text = `${text.slice(0, options.maxTextLength - 1)}…`;
      problems.push({ line: header.line, reason: 'A very long message was shortened' });
    }
    messages.push({ sentAt, sender: parts.sender, text, line: header.line });
  });

  return {
    messages,
    dateOrder: order,
    dateOrderIsAmbiguous: !options.dateOrder && detected.ambiguous,
    skippedLines,
    problems,
  };
}

const PHONE_NUMBER = /^\+?[\d\s()-]{7,}$/;

/**
 * Exports name unsaved contacts by their phone number. Phone numbers are never shown in the
 * portal, so such a sender is kept only as the last four digits.
 */
export function privateSenderName(sender: string): string {
  if (!PHONE_NUMBER.test(sender)) return sender;
  const digits = sender.replace(/\D/g, '');
  return `WhatsApp contact ending ${digits.slice(-4)}`;
}
