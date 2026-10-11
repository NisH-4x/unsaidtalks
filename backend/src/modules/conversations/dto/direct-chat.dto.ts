import { IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/transforms';

export class OpenDirectChatDto {
  @IsMongoId()
  userId: string;
}

export class ContactsQueryDto {
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(60)
  q?: string;
}
