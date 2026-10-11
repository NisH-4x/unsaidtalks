import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ToBoolean, Trim } from '../../../common/validation/transforms';
import { DOUBT_STATUSES, DoubtStatus, MESSAGE_TEXT_MAX_LENGTH } from '../schemas/message.schema';

/** Options shared by text and file messages. */
class MessageOptionsDto {
  @IsString()
  @Length(1, 64)
  clientId: string;

  /** The message being quoted, from the same conversation. */
  @IsOptional()
  @IsMongoId()
  replyToId?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isAnnouncement?: boolean;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  isDoubt?: boolean;
}

export class SendMessageDto extends MessageOptionsDto {
  @IsMongoId()
  conversationId: string;

  @Trim()
  @IsString()
  @Length(1, MESSAGE_TEXT_MAX_LENGTH, {
    message: `A message must be between 1 and ${MESSAGE_TEXT_MAX_LENGTH} characters`,
  })
  text: string;
}

const MAX_IMAGE_SIDE_PX = 20_000;

/** The form fields sent with a file. Every multipart value arrives as a string. */
export class SendAttachmentDto extends MessageOptionsDto {
  /** Optional caption. */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH, {
    message: `A caption can be at most ${MESSAGE_TEXT_MAX_LENGTH} characters`,
  })
  text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_SIDE_PX)
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_IMAGE_SIDE_PX)
  height?: number;
}

export class AttachmentQueryDto {
  /** Ask for a download instead of inline display. */
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  download?: boolean;
}

export class EditMessageDto {
  @Trim()
  @IsString()
  @MaxLength(MESSAGE_TEXT_MAX_LENGTH, {
    message: `A message can be at most ${MESSAGE_TEXT_MAX_LENGTH} characters`,
  })
  text: string;
}

export class DoubtStatusDto {
  @IsIn(DOUBT_STATUSES)
  status: DoubtStatus;
}

export class DoubtsQueryDto {
  @IsOptional()
  @IsIn(DOUBT_STATUSES)
  status?: DoubtStatus;
}

export class MessageSearchQueryDto {
  @Trim()
  @IsString()
  @Length(2, 100, { message: 'Search for 2 to 100 characters' })
  q: string;

  /** Cursor: results older than this message. */
  @IsOptional()
  @IsMongoId()
  before?: string;
}

export const HISTORY_PAGE_SIZE = 30;

/**
 * Cursor pagination: `before` loads older messages when scrolling up, `after` fetches
 * anything missed while disconnected. With neither, the newest page is returned.
 */
export class MessageHistoryQueryDto {
  @IsOptional()
  @IsMongoId()
  before?: string;

  @IsOptional()
  @IsMongoId()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = HISTORY_PAGE_SIZE;
}
