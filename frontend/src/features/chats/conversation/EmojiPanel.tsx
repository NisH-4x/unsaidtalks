import { BookOpen, Clock3, Hand, Heart, LucideIcon, PartyPopper, Smile } from 'lucide-react';
import { forwardRef, KeyboardEvent, MouseEvent, useRef, useState } from 'react';
import { SearchInput } from '../../../components/ui/SearchInput';
import { cn } from '../../../utils/cn';
import {
  EMOJI_CATEGORIES,
  EmojiCategoryKey,
  readRecentEmojis,
  rememberEmoji,
  searchEmoji,
} from '../../../utils/emoji';
import { scrollBehavior } from '../../../utils/motion';

interface Section {
  key: EmojiCategoryKey | 'recent';
  label: string;
  emojis: string[];
  icon: LucideIcon;
}

const ICONS: Record<EmojiCategoryKey, LucideIcon> = {
  smileys: Smile,
  gestures: Hand,
  hearts: Heart,
  study: BookOpen,
  fun: PartyPopper,
};

// Keeps the caret in the message box on computers, so emoji go where the person was typing.
function keepInputFocus(event: MouseEvent) {
  event.preventDefault();
}

function EmojiGrid({ emojis, onPick }: { emojis: string[]; onPick: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-8">
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onMouseDown={keepInputFocus}
          onClick={() => onPick(emoji)}
          className="flex h-10 items-center justify-center rounded-lg text-[1.6rem] transition-transform active:scale-90 active:bg-paper-sunk [@media(hover:hover)]:hover:bg-paper-sunk"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

interface EmojiPanelProps {
  onPick: (emoji: string) => void;
  className?: string;
}

/** The composer's emoji popup: categories, search, and the person's recently used emoji. */
export const EmojiPanel = forwardRef<HTMLDivElement, EmojiPanelProps>(function EmojiPanel(
  { onPick, className },
  ref,
) {
  // Read once per opening, so the recent row does not reorder while someone is picking.
  const [sections] = useState<Section[]>(() => {
    const recent = readRecentEmojis();
    const all = EMOJI_CATEGORIES.map((category) => ({ ...category, icon: ICONS[category.key] }));
    return recent.length > 0
      ? [{ key: 'recent', label: 'Recently used', emojis: recent, icon: Clock3 }, ...all]
      : all;
  });
  const [activeKey, setActiveKey] = useState(sections[0].key);
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<Section['key'], HTMLElement | null>>>({});
  const results = query.trim() ? searchEmoji(query) : null;

  function pick(emoji: string) {
    rememberEmoji(emoji);
    onPick(emoji);
  }

  function jumpTo(key: Section['key']) {
    setQuery('');
    setActiveKey(key);
    // After a search the sections are drawn again first, so wait for them.
    requestAnimationFrame(() => {
      const section = sectionRefs.current[key];
      scrollRef.current?.scrollTo({ top: section?.offsetTop ?? 0, behavior: scrollBehavior() });
    });
  }

  // The tab of the section at the top of the list is highlighted while scrolling.
  function trackActiveSection() {
    const top = (scrollRef.current?.scrollTop ?? 0) + 8;
    const passed = sections.filter(({ key }) => (sectionRefs.current[key]?.offsetTop ?? 0) <= top);
    setActiveKey(passed[passed.length - 1]?.key ?? sections[0].key);
  }

  // Enter picks the first result instead of sending the message.
  function handleSearchKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (results?.[0]) pick(results[0]);
  }

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Emoji"
      className={cn(
        'flex h-[min(24rem,55vh)] w-full origin-bottom-left flex-col overflow-hidden rounded-2xl bg-paper-raised shadow-card ring-1 ring-line motion-safe:animate-pop-in sm:w-[23rem]',
        className,
      )}
    >
      <div className="flex shrink-0 border-b border-line px-1">
        {sections.map(({ key, label, icon: Icon }) => {
          const active = !results && key === activeKey;
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-current={active ? 'true' : undefined}
              title={label}
              onMouseDown={keepInputFocus}
              onClick={() => jumpTo(key)}
              className={cn(
                'flex h-11 flex-1 items-center justify-center border-b-2 transition-colors',
                active
                  ? 'border-pine-500 text-pine-700'
                  : 'border-transparent text-ink-faint hover:text-ink-soft',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="shrink-0 px-3 pt-3" onKeyDown={handleSearchKeyDown}>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search emoji"
          label="Search emoji"
        />
      </div>

      <div
        ref={scrollRef}
        onScroll={results ? undefined : trackActiveSection}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {results ? (
          <section aria-label="Search results">
            <h3 className="px-1.5 pb-1.5 pt-3 text-xs font-semibold text-ink-muted">
              {results.length > 0 ? 'Search results' : 'No emoji found'}
            </h3>
            <EmojiGrid emojis={results} onPick={pick} />
          </section>
        ) : (
          sections.map(({ key, label, emojis }) => (
            <section
              key={key}
              ref={(element) => {
                sectionRefs.current[key] = element;
              }}
              aria-label={label}
            >
              <h3 className="px-1.5 pb-1.5 pt-3 text-xs font-semibold text-ink-muted">{label}</h3>
              <EmojiGrid emojis={emojis} onPick={pick} />
            </section>
          ))
        )}
      </div>
    </div>
  );
});
