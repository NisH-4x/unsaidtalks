import { Typist } from '../store/presence.store';

const firstName = (name: string) => name.split(' ')[0];

/** "typing…" in a private chat; "Priya is typing…", "Priya and Arjun are typing…" in groups. */
export function describeTyping(typists: Typist[], isGroup: boolean): string | null {
  if (typists.length === 0) return null;
  if (!isGroup) return 'typing…';
  if (typists.length === 1) return `${firstName(typists[0].name)} is typing…`;
  if (typists.length === 2) {
    return `${firstName(typists[0].name)} and ${firstName(typists[1].name)} are typing…`;
  }
  return `${typists.length} people are typing…`;
}
