import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { UserDeactivatedEvent, UserEvent } from '../users/user.events';
import { TokenService } from './token.service';

@Injectable()
export class SessionRevocationListener {
  constructor(private readonly tokens: TokenService) {}

  @OnEvent(UserEvent.Deactivated)
  async onUserDeactivated({ userId }: UserDeactivatedEvent): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }
}
