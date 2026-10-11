import { GroupDetailsInput } from '../../../api/admin.api';
import { AdminGroupSummary } from '../../../types/conversation';

export interface GroupDetailsValues {
  name: string;
  program: string;
  batch: string;
  description: string;
  allowMenteeDirectChat: boolean;
}

export const EMPTY_GROUP_DETAILS: GroupDetailsValues = {
  name: '',
  program: '',
  batch: '',
  description: '',
  allowMenteeDirectChat: false,
};

export function groupDetailsFrom(group: AdminGroupSummary): GroupDetailsValues {
  return {
    name: group.name,
    program: group.program ?? '',
    batch: group.batch ?? '',
    description: group.description,
    allowMenteeDirectChat: group.allowMenteeDirectChat,
  };
}

export function validateGroupName(name: string): string | undefined {
  const length = name.trim().length;
  return length >= 3 && length <= 80 ? undefined : 'Use 3 to 80 characters';
}

export function toGroupDetailsInput(values: GroupDetailsValues): GroupDetailsInput {
  return {
    name: values.name.trim(),
    program: values.program.trim(),
    batch: values.batch.trim(),
    description: values.description.trim(),
    allowMenteeDirectChat: values.allowMenteeDirectChat,
  };
}
