import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { isDuplicateKeyError } from '../../common/database/duplicate-key';
import { hashPassword } from '../../common/security/password';
import { escapeRegex } from '../../common/validation/escape-regex';
import { ListUsersQueryDto, UpdateUserByAdminDto } from './dto/admin-users.dto';
import { AccountStatus, User, UserDocument, UserRole } from './schemas/user.schema';
import { UserDeactivatedEvent, UserEvent } from './user.events';

export interface NewUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: AccountStatus;
}

export type MentorApplicationDecision = 'approve' | 'reject';

const ADMIN_LIST_LIMIT = 100;

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly events: EventEmitter2,
  ) {}

  findById(id: string | Types.ObjectId): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIds(ids: Array<string | Types.ObjectId>): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).select('+passwordHash').exec();
  }

  async recordLastSeen(userId: string, at: Date): Promise<void> {
    await this.userModel.updateOne({ _id: userId }, { lastSeenAt: at }).exec();
  }

  async create({ password, ...user }: NewUser): Promise<UserDocument> {
    try {
      return await this.userModel.create({ ...user, passwordHash: await hashPassword(password) });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  listForAdmin({ q, role, status }: ListUsersQueryDto): Promise<UserDocument[]> {
    const filter: FilterQuery<User> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    return this.userModel.find(filter).sort({ name: 1 }).limit(ADMIN_LIST_LIMIT).exec();
  }

  async updateByAdmin(
    adminId: string,
    id: Types.ObjectId,
    changes: UpdateUserByAdminDto,
  ): Promise<UserDocument> {
    if (!changes.role && !changes.status) {
      throw new BadRequestException('Nothing to change');
    }
    const user = await this.userModel.findById(id).exec();
    if (!user) throw new NotFoundException('User not found');
    if (user._id.equals(adminId) || user.role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be changed here');
    }
    if (user.status !== 'active' && user.status !== 'deactivated') {
      throw new ConflictException('Decide this mentor application on the Mentor requests screen');
    }

    const isDeactivation = changes.status === 'deactivated' && user.status === 'active';
    if (changes.role) user.role = changes.role;
    if (changes.status) user.status = changes.status;
    const saved = await user.save();

    if (isDeactivation) {
      await this.events.emitAsync(UserEvent.Deactivated, {
        userId: saved._id.toHexString(),
      } satisfies UserDeactivatedEvent);
    }
    return saved;
  }

  listMentorApplications(): Promise<UserDocument[]> {
    return this.userModel
      .find({ role: 'mentor', status: 'pending_approval' })
      .sort({ createdAt: 1 })
      .exec();
  }

  async decideMentorApplication(
    id: Types.ObjectId,
    decision: MentorApplicationDecision,
  ): Promise<UserDocument> {
    const status: AccountStatus = decision === 'approve' ? 'active' : 'rejected';
    const updated = await this.userModel
      .findOneAndUpdate(
        { _id: id, role: 'mentor', status: 'pending_approval' },
        { status },
        { new: true },
      )
      .exec();

    if (updated) return updated;
    if (await this.userModel.exists({ _id: id })) {
      throw new ConflictException('This user has no pending mentor application');
    }
    throw new NotFoundException('User not found');
  }
}
