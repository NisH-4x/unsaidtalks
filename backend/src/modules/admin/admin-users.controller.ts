import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ParseObjectIdPipe } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ListUsersQueryDto, UpdateUserByAdminDto } from '../users/dto/admin-users.dto';
import { AdminUserView, toAdminUserView } from '../users/user.views';
import { UsersService } from '../users/users.service';

@Controller('admin/users')
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto): Promise<AdminUserView[]> {
    return (await this.users.listForAdmin(query)).map(toAdminUserView);
  }

  @Patch(':id')
  async update(
    @CurrentUser() admin: AuthUser,
    @Param('id', ParseObjectIdPipe) id: Types.ObjectId,
    @Body() dto: UpdateUserByAdminDto,
  ): Promise<AdminUserView> {
    return toAdminUserView(await this.users.updateByAdmin(admin.id, id, dto));
  }
}
