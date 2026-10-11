import { AdminGroupDetails, AdminGroupSummary } from '../types/conversation';
import { AccountStatus, AdminUser, UserRole } from '../types/user';
import { api } from './client';

export type MentorApplicationDecision = 'approve' | 'reject';

export async function listMentorApplications(): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>('/admin/mentor-applications');
  return data;
}

export async function decideMentorApplication(
  id: string,
  decision: MentorApplicationDecision,
): Promise<AdminUser> {
  const { data } = await api.post<AdminUser>(`/admin/mentor-applications/${id}/${decision}`);
  return data;
}

export interface GroupDetailsInput {
  name: string;
  program?: string;
  batch?: string;
  description?: string;
  allowMenteeDirectChat?: boolean;
}

export async function listGroups(): Promise<AdminGroupSummary[]> {
  const { data } = await api.get<AdminGroupSummary[]>('/admin/groups');
  return data;
}

export async function getGroup(id: string): Promise<AdminGroupDetails> {
  const { data } = await api.get<AdminGroupDetails>(`/admin/groups/${id}`);
  return data;
}

export async function createGroup(
  input: GroupDetailsInput & { memberIds: string[] },
): Promise<AdminGroupDetails> {
  const { data } = await api.post<AdminGroupDetails>('/admin/groups', input);
  return data;
}

export async function updateGroup(
  id: string,
  changes: Partial<GroupDetailsInput>,
): Promise<AdminGroupDetails> {
  const { data } = await api.patch<AdminGroupDetails>(`/admin/groups/${id}`, changes);
  return data;
}

export async function addGroupMembers(id: string, userIds: string[]): Promise<AdminGroupDetails> {
  const { data } = await api.post<AdminGroupDetails>(`/admin/groups/${id}/members`, { userIds });
  return data;
}

export async function removeGroupMember(id: string, userId: string): Promise<AdminGroupDetails> {
  const { data } = await api.delete<AdminGroupDetails>(`/admin/groups/${id}/members/${userId}`);
  return data;
}

export interface UserFilters {
  q?: string;
  role?: UserRole;
  status?: AccountStatus;
}

export async function listUsers(filters: UserFilters = {}): Promise<AdminUser[]> {
  const { data } = await api.get<AdminUser[]>('/admin/users', { params: filters });
  return data;
}

export async function updateUser(
  id: string,
  changes: { role?: 'mentor' | 'mentee'; status?: 'active' | 'deactivated' },
): Promise<AdminUser> {
  const { data } = await api.patch<AdminUser>(`/admin/users/${id}`, changes);
  return data;
}
