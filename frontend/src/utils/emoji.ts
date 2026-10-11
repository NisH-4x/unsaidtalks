import { EMOJI_NAMES } from './emojiNames';

export type EmojiCategoryKey = 'smileys' | 'gestures' | 'hearts' | 'study' | 'fun';

export interface EmojiCategory {
  key: EmojiCategoryKey;
  label: string;
  emojis: string[];
}

const list = (emojis: string) => emojis.trim().split(/\s+/);

// Limited to emoji from Unicode 12 (2019) or earlier, which current phones and computers draw.
export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'smileys',
    label: 'Smileys',
    emojis: list(`
      😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑
      🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤧 🥵 🥶 🥴
      😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞
      😓 😩 😫 🥱 😤 😡 😠 😈 💀 🤡 👻 👽 🤖 😺 😸 😹 😻
    `),
  },
  {
    key: 'gestures',
    label: 'Gestures and people',
    emojis: list(`
      👍 👎 👌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 👏 🙌 👐 🤲 💪
      ✍️ 🤳 💅 👀 🧠 🙋 🙆 🙅 🤷 🤦 🙇 💁 🙎 👩‍💻 👨‍💻 👩‍🏫 👨‍🏫 👩‍🎓 👨‍🎓 👩‍💼 👨‍💼
    `),
  },
  {
    key: 'hearts',
    label: 'Hearts and symbols',
    emojis: list(`
      ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 ✅ ☑️ ✔️ ❌ ❎ ❗ ❓
      ‼️ ⁉️ ⚠️ 🔥 ✨ ⭐ 🌟 💫 💥 💢 💤 💬 💭 🆗 🆒 🆕 🆙 🔴 🟠 🟡 🟢 🔵 🟣 ⚪ ⚫ ➕ ➖ ➗
    `),
  },
  {
    key: 'study',
    label: 'Study and work',
    emojis: list(`
      📚 📖 📝 ✏️ 🖊️ 🖋️ 📒 📓 📔 📕 📗 📘 📙 📄 📃 📑 📊 📈 📉 📋 📌 📍 📎 🖇️ 📐 📏
      🗂️ 📁 📂 🗃️ 📅 📆 🗓️ ⏰ ⏱️ ⏳ ⌛ 💻 🖥️ ⌨️ 🖱️ 📱 ☎️ 📧 📨 💡 🔍 🔎 🔒 🔑 🧮 🧪 🔬 🎓
      🏫 🏆 🥇 🥈 🥉 🏅 🎯 🚀 💼 💰
    `),
  },
  {
    key: 'fun',
    label: 'Food, fun and nature',
    emojis: list(`
      🎉 🎊 🎂 🎁 🎈 🎀 🍰 🧁 ☕ 🍵 🥤 🍕 🍔 🍟 🌮 🍜 🍛 🍫 🍩 🍪 🍿 🍎 🍌 🥭 🍉 🎮
      🎧 🎵 🎶 🎸 🏏 ⚽ 🏀 🏸 🏓 🎬 📸 🌈 ☀️ 🌤️ 🌧️ ⛈️ ❄️ 🌙 ⚡ 🌸 🌻 🌹 🌱 🍀 🌍 🐶
      🐱 🦁 🐯 🐼 🐵 🦄 🐢 🦋 🐝
    `),
  },
];

const nameWords = (emoji: string) => (EMOJI_NAMES[emoji] ?? '').split(/[^a-z0-9]+/);
const SEARCHABLE = EMOJI_CATEGORIES.flatMap((category) =>
  category.emojis.map((emoji) => ({ emoji, words: nameWords(emoji) })),
);

/** Emoji with a name word starting with each word of the query, in the panel's order. */
export function searchEmoji(query: string): string[] {
  const queryWords = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (queryWords.length === 0) return [];
  return SEARCHABLE.filter(({ words }) =>
    queryWords.every((queryWord) => words.some((word) => word.startsWith(queryWord))),
  ).map(({ emoji }) => emoji);
}

const RECENT_KEY = 'unsaidtalks.recentEmojis';
const RECENT_LIMIT = 24;

/** Moves an emoji to the front of the recently used list. */
export function addRecentEmoji(recent: string[], emoji: string): string[] {
  return [emoji, ...recent.filter((item) => item !== emoji)].slice(0, RECENT_LIMIT);
}

// The list lives in this browser only; storage can be unavailable (private windows).
export function readRecentEmojis(): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is string => typeof item === 'string').slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string): void {
  try {
    window.localStorage.setItem(
      RECENT_KEY,
      JSON.stringify(addRecentEmoji(readRecentEmojis(), emoji)),
    );
  } catch {
    // Without storage the panel just has no recently used section.
  }
}
