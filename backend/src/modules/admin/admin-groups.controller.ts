import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminGroupDetails, AdminGroupSummary } from '../conversations/conversation.views';
import { AddMembersDto, CreateGroupDto, UpdateGroupDto } from '../conversations/dto/group.dto';
import { GroupsService } from '../conversations/groups.service';

@Controller('admin/groups')
@Roles('admin')
export class AdminGroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Get()
  list(): Promise<AdminGroupSummary[]> {
    return this.groups.list();
  }

  @Post()
  create(@CurrentUser() admin: AuthUser, @Body() dto: CreateGroupDto): Promise<AdminGroupDetails> {
    return this.groups.create(admin, dto);
  }

  @Get(':id')
  get(@Param('id', ParseObjectIdPipe) id: Types.ObjectId): Promise<AdminGroupDetails> {
    return this.groups.get(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateGroupDto,
  ): Promise<AdminGroupDetails> {
    return this.groups.update(id, dto);
  }

  @Post(':id/members')
  addMembers(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: AddMembersDto,
  ): Promise<AdminGroupDetails> {
    return this.groups.addMembers(admin, id, dto.userIds);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Param('userId', ParseObjectIdPipe) userId: Types.ObjectId,
  ): Promise<AdminGroupDetails> {
    return this.groups.removeMember(admin, id, userId);
  }
}
