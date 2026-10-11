import { api } from './client';

export interface DoubtSummary {
  status: 'ready' | 'empty';
  doubtCount: number;
  omittedCount: number;
  overview: string;
  topics: Array<{
    title: string;
    summary: string;
    doubts: Array<{ messageId: string; askedBy: string; askedAt: string; preview: string }>;
  }>;
  generatedAt: string | null;
  model: string | null;
}

/** Asks the server for an AI summary of the group's open doubts (generated with Groq). */
export async function summariseDoubts(conversationId: string): Promise<DoubtSummary> {
  const { data } = await api.post<DoubtSummary>(`/conversations/${conversationId}/doubts/summary`);
  return data;
}
