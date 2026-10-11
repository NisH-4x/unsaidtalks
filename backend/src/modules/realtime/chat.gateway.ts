import { BeforeApplicationShutdown, HttpException, Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { AuthUser } from '../auth/auth-user';
import { AuthService } from '../auth/auth.service';
import { ConversationsService } from '../conversations/conversations.service';
import { SendMessageDto } from '../messages/dto/message.dto';
import { MessageView } from '../messages/message.views';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { PresenceService } from './presence.service';
import { SlidingWindowLimiter } from './sliding-window-limiter';
import { ConversationRefDto, parsePayload } from './socket-payload';
import { Ack, conversationRoom, SocketEvent, userRoom } from './socket-events';

interface SocketData {
  user: AuthUser;
}

export type ChatSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;
export type ChatNamespace = Namespace<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

const MESSAGES_PER_WINDOW = 10;
const MESSAGE_WINDOW_MS = 5_000;

// WebSocket transport only: the assignment asks for WebSockets, not HTTP long-polling.
@WebSocketGateway({ namespace: 'chat', transports: ['websocket'], serveClient: false })
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, BeforeApplicationShutdown
{
  @WebSocketServer()
  server: ChatNamespace;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly sendLimiter = new SlidingWindowLimiter(MESSAGES_PER_WINDOW, MESSAGE_WINDOW_MS);
  private readonly pendingPresenceTasks = new Set<Promise<void>>();
  private shuttingDown = false;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
    private readonly presence: PresenceService,
  ) {}

  /**
   * Every connection is authenticated and placed in its rooms during the handshake, before
   * it is accepted, so no message can slip through between "connected" and "joined".
   */
  afterInit(server: ChatNamespace): void {
    server.use((socket, next) => {
      this.admit(socket).then(
        () => next(),
        () => next(new Error('unauthorized')),
      );
    });
  }

  async handleConnection(socket: ChatSocket): Promise<void> {
    const { id } = socket.data.user;
    if (!this.presence.connect(id)) return;
    await this.runPresenceTask(id, () => this.announcePresence(id, { online: true }));
  }

  async handleDisconnect(socket: ChatSocket): Promise<void> {
    const user = socket.data.user as AuthUser | undefined;
    if (!user || !this.presence.disconnect(user.id)) return;
    // Shutting down closes every socket at once; there is no one left to tell.
    if (this.shuttingDown) return;

    await this.runPresenceTask(user.id, async () => {
      const lastSeenAt = new Date();
      await this.users.recordLastSeen(user.id, lastSeenAt);
      // The user may have reconnected (a page reload) while last-seen was being saved.
      if (!this.presence.isOnline(user.id)) {
        await this.announcePresence(user.id, { online: false, lastSeenAt });
      }
    });
  }

  /** Lets presence writes already under way finish before the database connection closes. */
  async beforeApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all(this.pendingPresenceTasks);
  }

  /** Who among the people sharing a conversation with this user is online right now. */
  @SubscribeMessage(SocketEvent.PresenceSync)
  async onPresenceSync(@ConnectedSocket() socket: ChatSocket): Promise<Ack<{ online: string[] }>> {
    const contactIds = await this.conversations.listContactIds(socket.data.user.id);
    return { ok: true, online: this.presence.onlineAmong(contactIds) };
  }

  @SubscribeMessage(SocketEvent.TypingStart)
  onTypingStart(@ConnectedSocket() socket: ChatSocket, @MessageBody() payload: unknown): void {
    this.relayTyping(socket, payload, true);
  }

  @SubscribeMessage(SocketEvent.TypingStop)
  onTypingStop(@ConnectedSocket() socket: ChatSocket, @MessageBody() payload: unknown): void {
    this.relayTyping(socket, payload, false);
  }

  @SubscribeMessage(SocketEvent.MessageSend)
  async onMessageSend(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack<{ message: MessageView }>> {
    const parsed = parsePayload(SendMessageDto, payload);
    if ('error' in parsed) return { ok: false, error: parsed.error };

    const sender = await this.currentUser(socket);
    if (!sender) {
      socket.disconnect(true);
      return { ok: false, error: 'Your session has ended. Please sign in again.' };
    }
    if (!this.sendLimiter.tryAcquire(sender.id)) {
      return { ok: false, error: 'You are sending messages too quickly. Please wait a moment.' };
    }

    try {
      return { ok: true, message: await this.messages.send(sender, parsed.value) };
    } catch (error) {
      return { ok: false, error: this.describe(error) };
    }
  }

  /** Lets an admin follow a group live while viewing it as a moderator (members are already in). */
  @SubscribeMessage(SocketEvent.ConversationOpen)
  async onConversationOpen(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack> {
    const parsed = parsePayload(ConversationRefDto, payload);
    if ('error' in parsed) return { ok: false, error: parsed.error };

    try {
      await this.conversations.requireAccess(socket.data.user, parsed.value.conversationId);
      await socket.join(conversationRoom(parsed.value.conversationId));
      return { ok: true };
    } catch (error) {
      return { ok: false, error: this.describe(error) };
    }
  }

  @SubscribeMessage(SocketEvent.ConversationClose)
  async onConversationClose(
    @ConnectedSocket() socket: ChatSocket,
    @MessageBody() payload: unknown,
  ): Promise<Ack> {
    const parsed = parsePayload(ConversationRefDto, payload);
    if ('error' in parsed) return { ok: false, error: parsed.error };

    const { conversationId } = parsed.value;
    if (!(await this.conversations.isMember(socket.data.user.id, conversationId))) {
      await socket.leave(conversationRoom(conversationId));
    }
    return { ok: true };
  }

  private async admit(socket: ChatSocket): Promise<void> {
    const { token } = socket.handshake.auth as { token?: unknown };
    if (typeof token !== 'string') throw new Error('Missing access token');

    const user = await this.auth.authenticate(token);
    socket.data.user = user;
    const conversationIds = await this.conversations.listConversationIdsForUser(user.id);
    await socket.join([userRoom(user.id), ...conversationIds.map(conversationRoom)]);
  }

  // Nest does not await connection hooks, so a failure here would otherwise surface as an
  // unhandled promise rejection, which stops the Node process.
  private async runPresenceTask(userId: string, task: () => Promise<void>): Promise<void> {
    const run = task().catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Presence update for user ${userId} failed: ${reason}`);
    });
    this.pendingPresenceTasks.add(run);
    try {
      await run;
    } finally {
      this.pendingPresenceTasks.delete(run);
    }
  }

  // Presence is shared only with people who have a conversation in common with the user.
  private async announcePresence(
    userId: string,
    status: { online: boolean; lastSeenAt?: Date },
  ): Promise<void> {
    const conversationIds = await this.conversations.listConversationIdsForUser(userId);
    if (conversationIds.length === 0) return;
    this.server
      .to(conversationIds.map(conversationRoom))
      .emit(SocketEvent.PresenceUpdate, { userId, ...status });
  }

  // Typing is relayed only into rooms this socket has already joined (as a member or a
  // following moderator), so it needs no database lookup and cannot reach other groups.
  private relayTyping(socket: ChatSocket, payload: unknown, isTyping: boolean): void {
    const parsed = parsePayload(ConversationRefDto, payload);
    if ('error' in parsed) return;

    const { conversationId } = parsed.value;
    const room = conversationRoom(conversationId);
    if (!socket.rooms.has(room)) return;

    const { id, name } = socket.data.user;
    socket.to(room).emit(SocketEvent.Typing, { conversationId, userId: id, name, isTyping });
  }

  // A socket can stay open for hours, so role and account status are re-read for each
  // action rather than trusted from the handshake.
  private async currentUser(socket: ChatSocket): Promise<AuthUser | null> {
    const user = await this.users.findById(socket.data.user.id);
    if (!user || user.status !== 'active') return null;
    return { id: user._id.toHexString(), name: user.name, role: user.role };
  }

  private describe(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      const { message } = response as { message?: string | string[] };
      return (Array.isArray(message) ? message[0] : message) ?? error.message;
    }
    this.logger.error(error);
    return 'Something went wrong. Please try again.';
  }
}
