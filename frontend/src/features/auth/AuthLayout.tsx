import { LockKeyhole } from 'lucide-react';
import { ReactNode } from 'react';
import { Logo } from '../../components/Logo';
import { ConversationPreview } from './ConversationPreview';

interface AuthLayoutProps {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-full lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="grain relative hidden overflow-hidden bg-pine-800 px-12 py-10 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-marigold-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-pine-400/20 blur-3xl" />

        <Logo tone="paper" />

        <div className="my-auto max-w-lg py-12">
          <h1 className="animate-rise-in font-display text-[2.75rem] font-medium leading-[1.08] tracking-tight text-paper-raised">
            Mentorship, <em className="font-medium text-marigold-300">minus</em> the noise.
          </h1>
          <p
            className="mt-4 max-w-md animate-rise-in text-[17px] leading-relaxed text-pine-100/80"
            style={{ animationDelay: '100ms' }}
          >
            Program groups, private doubts and announcements that don&apos;t get buried under casual
            chat.
          </p>
          <div className="mt-10">
            <ConversationPreview />
          </div>
        </div>

        <p className="flex items-center gap-2 text-sm text-pine-100/70">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Phone numbers and emails stay private. Always.
        </p>
      </aside>

      <main className="flex min-h-full flex-col px-5 pb-10 pt-6 sm:px-8 lg:justify-center lg:px-16">
        <Logo className="lg:hidden" />

        <div className="mx-auto w-full max-w-[25rem] flex-1 pt-10 lg:flex-none lg:pt-0">
          <h2 className="animate-rise-in font-display text-[2rem] font-medium leading-tight tracking-tight">
            {title}
          </h2>
          <div
            className="mt-2 animate-rise-in text-[15px] text-ink-muted"
            style={{ animationDelay: '60ms' }}
          >
            {subtitle}
          </div>
          <div className="mt-8 animate-rise-in" style={{ animationDelay: '120ms' }}>
            {children}
          </div>
        </div>

        <p className="mx-auto mt-10 flex items-center gap-2 text-sm text-ink-muted lg:hidden">
          <LockKeyhole className="h-4 w-4" aria-hidden="true" />
          Phone numbers and emails stay private.
        </p>
      </main>
    </div>
  );
}
