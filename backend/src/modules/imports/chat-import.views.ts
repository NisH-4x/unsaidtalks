import { PublicUserView } from '../users/user.views';
import { DateOrder, ParseProblem } from './whatsapp-parser';

export interface ImportPreviewView {
  fileName: string;
  dateOrder: DateOrder;
  dateOrderIsAmbiguous: boolean;
  messageCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  /** Everyone who wrote in the export, with the member they most likely are. */
  senders: Array<{ name: string; messageCount: number; suggestedUserId: string | null }>;
  members: PublicUserView[];
  sample: Array<{ sentAt: Date; sender: string; text: string }>;
  problems: ParseProblem[];
  problemCount: number;
  skippedLines: number;
  /** Set when this exact file was imported into the group before. */
  alreadyImported: { importedAt: Date; importedCount: number } | null;
  /** Messages that an earlier import already brought in and that would be skipped. */
  duplicateCount: number;
}

export interface ChatImportView {
  id: string;
  fileName: string;
  importedBy: PublicUserView | null;
  importedCount: number;
  skippedCount: number;
  firstMessageAt: Date;
  lastMessageAt: Date;
  createdAt: Date;
}
