import { ChatImportRecord, DateOrder, ImportPreview } from '../types/chatImport';
import { api } from './client';

function exportForm(file: File, dateOrder?: DateOrder, extra: Record<string, string> = {}) {
  const form = new FormData();
  // Exports carry local times without a time zone, so they are read in the uploader's.
  form.append('timezoneOffsetMinutes', String(new Date().getTimezoneOffset()));
  if (dateOrder) form.append('dateOrder', dateOrder);
  for (const [key, value] of Object.entries(extra)) form.append(key, value);
  form.append('file', file);
  return form;
}

export async function previewImport(
  groupId: string,
  file: File,
  dateOrder?: DateOrder,
): Promise<ImportPreview> {
  const { data } = await api.post<ImportPreview>(
    `/admin/groups/${groupId}/imports/preview`,
    exportForm(file, dateOrder),
  );
  return data;
}

/** `links` maps each sender name in the export to a member id, or null to keep the name only. */
export async function importChat(
  groupId: string,
  file: File,
  dateOrder: DateOrder,
  links: Record<string, string | null>,
): Promise<ChatImportRecord> {
  const { data } = await api.post<ChatImportRecord>(
    `/admin/groups/${groupId}/imports`,
    exportForm(file, dateOrder, { mapping: JSON.stringify(links) }),
  );
  return data;
}

export async function listImports(groupId: string): Promise<ChatImportRecord[]> {
  const { data } = await api.get<ChatImportRecord[]>(`/admin/groups/${groupId}/imports`);
  return data;
}
