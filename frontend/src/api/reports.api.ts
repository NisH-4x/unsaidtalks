import { ReportDecision, ReportedMessage, ReportReason, ReportStatus } from '../types/report';
import { api } from './client';

export async function reportMessage(
  messageId: string,
  report: { reason: ReportReason; note?: string },
): Promise<void> {
  await api.post(`/messages/${messageId}/report`, report);
}

export async function listReports(status: ReportStatus): Promise<ReportedMessage[]> {
  const { data } = await api.get<ReportedMessage[]>('/admin/reports', { params: { status } });
  return data;
}

export async function countOpenReports(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/admin/reports/open-count');
  return data.count;
}

export async function decideReport(
  messageId: string,
  decision: ReportDecision,
): Promise<ReportedMessage> {
  const { data } = await api.patch<ReportedMessage>(`/admin/reports/${messageId}`, { decision });
  return data;
}

export const reportedAttachmentPath = (messageId: string) =>
  `/admin/reports/${messageId}/attachment`;
