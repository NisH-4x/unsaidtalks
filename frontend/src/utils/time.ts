const DAY_MS = 24 * 60 * 60 * 1000;

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * DAY_MS],
  ['month', 30 * DAY_MS],
  ['week', 7 * DAY_MS],
  ['day', DAY_MS],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

const relativeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function formatRelative(value: string | Date, now = Date.now()): string {
  const elapsed = new Date(value).getTime() - now;
  for (const [unit, unitMs] of UNITS) {
    if (Math.abs(elapsed) >= unitMs) {
      return relativeFormat.format(Math.round(elapsed / unitMs), unit);
    }
  }
  return 'just now';
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function formatMessageTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** Label for the date separators inside a conversation. */
export function formatDayLabel(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, new Date(now.getTime() - DAY_MS))) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}

/** "last seen today at 7:42 pm", "last seen yesterday at 9:10 am", "last seen on 12 Oct". */
export function formatLastSeen(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  if (isSameDay(date, now)) return `last seen today at ${formatMessageTime(date)}`;
  if (isSameDay(date, new Date(now.getTime() - DAY_MS))) {
    return `last seen yesterday at ${formatMessageTime(date)}`;
  }
  return `last seen on ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** Chat-list style: time today, "Yesterday", weekday within a week, otherwise the date. */
export function formatChatTime(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  if (isSameDay(date, now)) return formatMessageTime(date);
  if (isSameDay(date, new Date(now.getTime() - DAY_MS))) return 'Yesterday';
  if (now.getTime() - date.getTime() < 6 * DAY_MS) {
    return date.toLocaleDateString('en-IN', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
