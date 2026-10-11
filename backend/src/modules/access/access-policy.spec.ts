import { UserRole } from '../users/schemas/user.schema';
import {
  canAskDoubts,
  canDeleteMessage,
  canJoinGroups,
  canMessageDirectly,
  canPinMessages,
  canPostAnnouncements,
  canReportMessage,
  canResolveDoubts,
  canStartDirectChat,
  conversationAccess,
  DirectChatFacts,
} from './access-policy';

describe('mentor tools', () => {
  it.each([
    // role,    type,     announce, pin,   ask doubt, resolve doubt
    ['mentor', 'group', true, true, false, true],
    ['admin', 'group', true, true, false, true],
    ['mentee', 'group', false, false, true, false],
    ['mentor', 'direct', false, false, false, false],
    ['mentee', 'direct', false, false, false, false],
  ] as const)(
    'a %s in a %s conversation: announce %s, pin %s, ask doubts %s, resolve doubts %s',
    (role, type, announce, pin, ask, resolve) => {
      expect(canPostAnnouncements(role, type)).toBe(announce);
      expect(canPinMessages(role, type)).toBe(pin);
      expect(canAskDoubts(role, type)).toBe(ask);
      expect(canResolveDoubts(role, type)).toBe(resolve);
    },
  );
});

describe('deleting and reporting messages', () => {
  it.each([
    // role,    type,     own message, delete, report
    ['mentee', 'group', true, true, false],
    ['mentee', 'group', false, false, true],
    ['mentor', 'group', false, true, true],
    ['admin', 'group', false, true, false],
    ['mentor', 'direct', true, true, false],
    ['mentor', 'direct', false, false, true],
    ['admin', 'direct', false, false, false],
  ] as const)(
    '%s in a %s chat (own message: %s): delete %s, report %s',
    (role, conversationType, isSender, mayDelete, mayReport) => {
      const facts = { role, conversationType, isSender };
      expect(canDeleteMessage(facts)).toBe(mayDelete);
      expect(canReportMessage(facts)).toBe(mayReport);
    },
  );
});

describe('conversationAccess', () => {
  it.each([
    ['mentee', true, 'group', 'member'],
    ['mentee', false, 'group', 'none'],
    ['mentee', true, 'direct', 'member'],
    ['mentee', false, 'direct', 'none'],
    ['mentor', true, 'group', 'member'],
    ['mentor', false, 'group', 'none'],
    ['mentor', false, 'direct', 'none'],
    ['admin', true, 'group', 'member'],
    ['admin', false, 'group', 'moderator'],
    ['admin', true, 'direct', 'member'],
    ['admin', false, 'direct', 'none'],
  ] as const)(
    'a %s (member: %s) of a %s conversation gets "%s" access',
    (role, isMember, conversationType, expected) => {
      expect(conversationAccess({ role, isMember, conversationType })).toBe(expected);
    },
  );
});

describe('canJoinGroups', () => {
  it.each([
    ['mentee', 'active', true],
    ['mentor', 'active', true],
    ['admin', 'active', false],
    ['mentor', 'pending_approval', false],
    ['mentor', 'rejected', false],
    ['mentee', 'deactivated', false],
  ] as const)('a %s with status %s can join: %s', (role, status, expected) => {
    expect(canJoinGroups({ role, status })).toBe(expected);
  });
});

type GroupSetting = 'no shared group' | 'mentee chats off' | 'mentee chats on';

function facts(from: UserRole, to: UserRole, groups: GroupSetting): DirectChatFacts {
  const sharedGroups =
    groups === 'no shared group' ? [] : [{ allowMenteeDirectChat: groups === 'mentee chats on' }];
  return {
    initiator: { id: 'a', role: from, status: 'active' },
    recipient: { id: 'b', role: to, status: 'active' },
    sharedGroups,
  };
}

describe('canStartDirectChat', () => {
  it.each([
    ['mentee', 'mentor', 'mentee chats off', true],
    ['mentee', 'mentor', 'no shared group', false],
    ['mentor', 'mentee', 'mentee chats off', true],
    ['mentor', 'mentee', 'no shared group', false],
    ['mentor', 'mentor', 'mentee chats off', true],
    ['mentee', 'mentee', 'mentee chats off', false],
    ['mentee', 'mentee', 'mentee chats on', true],
    ['mentee', 'mentee', 'no shared group', false],
    ['admin', 'mentee', 'no shared group', true],
    ['admin', 'mentor', 'no shared group', true],
    ['mentee', 'admin', 'mentee chats off', false],
    ['mentor', 'admin', 'mentee chats off', false],
  ] as const)('%s → %s (%s): %s', (from, to, groups, expected) => {
    expect(canStartDirectChat(facts(from, to, groups))).toBe(expected);
  });

  it('refuses a chat with yourself or with an inactive account', () => {
    const self = facts('mentor', 'mentee', 'mentee chats off');
    self.recipient.id = self.initiator.id;
    expect(canStartDirectChat(self)).toBe(false);

    const inactive = facts('mentee', 'mentor', 'mentee chats off');
    inactive.recipient.status = 'deactivated';
    expect(canStartDirectChat(inactive)).toBe(false);
  });
});

describe('canMessageDirectly', () => {
  it.each([
    ['mentee', 'mentor', 'mentee chats off', true],
    ['mentee', 'mentor', 'no shared group', false],
    ['mentee', 'mentee', 'mentee chats off', false],
    ['mentee', 'admin', 'no shared group', true],
    ['admin', 'mentee', 'no shared group', true],
  ] as const)('%s → %s (%s): %s', (from, to, groups, expected) => {
    expect(canMessageDirectly(facts(from, to, groups))).toBe(expected);
  });
});
