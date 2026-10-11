import { PublicUser } from './user';

export type DateOrder = 'day-first' | 'month-first';

export interface ImportPreview {
  fileName: string;
  dateOrder: DateOrder;
  dateOrderIsAmbiguous: boolean;
  messageCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  senders: Array<{ name: string; messageCount: number; suggestedUserId: string | null }>;
  members: PublicUser[];
  sample: Array<{ sentAt: string; sender: string; text: string }>;
  problems: Array<{ line: number; reason: string }>;
  problemCount: number;
  skippedLines: number;
  alreadyImported: { importedAt: string; importedCount: number } | null;
  duplicateCount: number;
}

export interface ChatImportRecord {
  id: string;
  fileName: string;
  importedBy: PublicUser | null;
  importedCount: number;
  skippedCount: number;
  firstMessageAt: string;
  lastMessageAt: string;
  createdAt: string;
}
