import { CircleCheck, CircleQuestionMark } from 'lucide-react';
import { Message } from '../../../types/message';

interface DoubtChipProps {
  doubt: NonNullable<Message['doubt']>;
  resolverName?: string;
}

export function DoubtChip({ doubt, resolverName }: DoubtChipProps) {
  if (doubt.status === 'open') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-clay-50 px-2 py-0.5 text-[11px] font-semibold text-clay-600 ring-1 ring-clay-200">
        <CircleQuestionMark className="h-3 w-3" aria-hidden="true" />
        Doubt · open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pine-50 px-2 py-0.5 text-[11px] font-semibold text-pine-700 ring-1 ring-pine-200">
      <CircleCheck className="h-3 w-3" aria-hidden="true" />
      {resolverName ? `Resolved by ${resolverName}` : 'Resolved'}
    </span>
  );
}
