const NAMED_LIMIT = 3;

/** "Ananya added Priya", "... Priya and Rahul", "... Priya, Rahul and Sneha", "... Priya, Rahul and 3 others". */
export function describeMembersAdded(actorName: string, memberNames: string[]): string {
  if (memberNames.length <= NAMED_LIMIT) {
    return `${actorName} added ${joinNames(memberNames)}`;
  }
  const named = memberNames.slice(0, NAMED_LIMIT - 1);
  const others = memberNames.length - named.length;
  return `${actorName} added ${named.join(', ')} and ${others} others`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
