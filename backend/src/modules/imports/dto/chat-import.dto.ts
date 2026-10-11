import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DateOrder } from '../whatsapp-parser';

/** Form fields sent with the exported .txt file. */
export class ImportOptionsDto {
  @IsOptional()
  @IsIn(['day-first', 'month-first'])
  dateOrder?: DateOrder;

  /** The uploader's browser offset (Date#getTimezoneOffset), since exports have no time zone. */
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  timezoneOffsetMinutes: number;
}

export class ImportChatDto extends ImportOptionsDto {
  /** JSON: each sender name in the export mapped to a member's id, or to null to leave it unlinked. */
  @IsString()
  @MaxLength(100_000)
  mapping: string;
}
