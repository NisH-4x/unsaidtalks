import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminUserView, toAdminUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';

@Controller('admin/mentor-applications')
@Roles('admin')
export class MentorApplicationsController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(): Promise<AdminUserView[]> {
    const applicants = await this.users.listMentorApplications();
    return applicants.map(toAdminUserView);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(@Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<AdminUserView> {
    return toAdminUserView(await this.users.decideMentorApplication(id, 'approve'));
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(@Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<AdminUserView> {
    return toAdminUserView(await this.users.decideMentorApplication(id, 'reject'));
  }
}
