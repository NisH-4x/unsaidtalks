import { ArrayMaxSize, IsArray, IsMongoId, IsOptional } from 'class-validator';

export class NotificationsQueryDto {
  /** Cursor: load notifications older than this one. */
  @IsOptional()
  @IsMongoId()
  before?: string;
}

export class MarkNotificationsReadDto {
  /** The notifications to mark as read; all of them when omitted. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids?: string[];
}
