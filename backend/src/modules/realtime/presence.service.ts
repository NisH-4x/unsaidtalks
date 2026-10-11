import { Injectable } from '@nestjs/common';

/**
 * Counts open connections per user. Someone is online from their first open tab until
 * their last one closes. In-memory, so it describes this server process only; running
 * several instances would need a shared store such as Redis.
 */
@Injectable()
export class PresenceService {
  private readonly connections = new Map<string, number>();

  /** Returns true when this is the user's first open connection. */
  connect(userId: string): boolean {
    const count = (this.connections.get(userId) ?? 0) + 1;
    this.connections.set(userId, count);
    return count === 1;
  }

  /** Returns true when the user's last open connection has just closed. */
  disconnect(userId: string): boolean {
    const count = (this.connections.get(userId) ?? 0) - 1;
    if (count > 0) {
      this.connections.set(userId, count);
      return false;
    }
    this.connections.delete(userId);
    return true;
  }

  isOnline(userId: string): boolean {
    return this.connections.has(userId);
  }

  onlineAmong(userIds: string[]): string[] {
    return userIds.filter((userId) => this.connections.has(userId));
  }
}
