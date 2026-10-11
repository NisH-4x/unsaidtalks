import { ReportReason } from '../types/report';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam or advertising',
  abuse: 'Abuse or harassment',
  personal_info: "Shares someone's personal information",
  other: 'Something else',
};
