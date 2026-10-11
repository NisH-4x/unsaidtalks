import { Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { ChatGateway, ChatNamespace, ChatSocket } from './chat.gateway';
import { PresenceService } from './presence.service';

const rahul = { id: 'u-rahul', name: 'Rahul Verma', role: 'mentee' as const };
const socketOf = (user: typeof rahul) => ({ data: { user } }) as unknown as ChatSocket;

function setUp(recordLastSeen: jest.Mock) {
  const users = { recordLastSeen } as unknown as UsersService;
  const conversations = {
    listConversationIdsForUser: jest.fn().mockResolvedValue(['c1']),
  } as unknown as ConversationsService;
  const gateway = new ChatGateway(
    {} as AuthService,
    users,
    conversations,
    {} as MessagesService,
    new PresenceService(),
  );
  const emit = jest.fn();
  gateway.server = { to: () => ({ emit }) } as unknown as ChatNamespace;
  return { gateway, emit };
}

describe('ChatGateway presence', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('logs a failed last-seen write instead of rejecting', async () => {
    const { gateway, emit } = setUp(jest.fn().mockRejectedValue(new Error('connection lost')));
    await gateway.handleConnection(socketOf(rahul));

    await expect(gateway.handleDisconnect(socketOf(rahul))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('connection lost'));
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('waits for last-seen writes under way before shutting down', async () => {
    let finishWrite = () => {};
    const recordLastSeen = jest.fn(() => new Promise<void>((resolve) => (finishWrite = resolve)));
    const { gateway } = setUp(recordLastSeen);
    await gateway.handleConnection(socketOf(rahul));
    void gateway.handleDisconnect(socketOf(rahul));

    let shutDown = false;
    const shutdown = gateway.beforeApplicationShutdown().then(() => (shutDown = true));
    await Promise.resolve();
    expect(shutDown).toBe(false);

    finishWrite();
    await shutdown;
    expect(shutDown).toBe(true);
  });

  it('skips presence updates for sockets closed by the shutdown itself', async () => {
    const recordLastSeen = jest.fn().mockResolvedValue(undefined);
    const { gateway } = setUp(recordLastSeen);
    await gateway.handleConnection(socketOf(rahul));

    await gateway.beforeApplicationShutdown();
    await gateway.handleDisconnect(socketOf(rahul));

    expect(recordLastSeen).not.toHaveBeenCalled();
  });
});
