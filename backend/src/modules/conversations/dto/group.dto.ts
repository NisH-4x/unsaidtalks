import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Trim } from '../../../common/validation/transforms';

export class CreateGroupDto {
  @Trim()
  @IsString()
  @Length(3, 80, { message: 'Group name must be between 3 and 80 characters' })
  name: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(80)
  program?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(40)
  batch?: string;

  @IsOptional()
  @IsBoolean()
  allowMenteeDirectChat?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsMongoId({ each: true })
  memberIds?: string[];
}

export class UpdateGroupDto extends PartialType(OmitType(CreateGroupDto, ['memberIds'] as const)) {}

export class AddMembersDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one person to add' })
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  userIds: string[];
}
