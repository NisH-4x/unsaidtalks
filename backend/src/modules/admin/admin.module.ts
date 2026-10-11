import { Module } from '@nestjs/common';
import { ConversationsModule } from '../conversations/conversations.module';
import { UsersModule } from '../users/users.module';
import { AdminGroupsController } from './admin-groups.controller';
import { AdminUsersController } from './admin-users.controller';
import { MentorApplicationsController } from './mentor-applications.controller';

@Module({
  imports: [UsersModule, ConversationsModule],
  controllers: [MentorApplicationsController, AdminGroupsController, AdminUsersController],
})
export class AdminModule {}
