export const UserEvent = {
  Deactivated: 'user.deactivated',
} as const;

export interface UserDeactivatedEvent {
  userId: string;
}
