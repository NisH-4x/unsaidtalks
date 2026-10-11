import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../../common/validation/transforms';
import {
  REPORT_REASONS,
  REPORT_STATUSES,
  ReportReason,
  ReportStatus,
} from '../schemas/report.schema';

export class ReportMessageDto {
  @IsIn(REPORT_REASONS, { message: 'Choose a reason for the report' })
  reason: ReportReason;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500, { message: 'The note can be at most 500 characters' })
  note?: string;
}

export class ReportsQueryDto {
  @IsOptional()
  @IsIn(REPORT_STATUSES)
  status: ReportStatus = 'open';
}

export const REPORT_DECISIONS = ['dismiss', 'remove-message'] as const;
export type ReportDecision = (typeof REPORT_DECISIONS)[number];

export class ReportDecisionDto {
  @IsIn(REPORT_DECISIONS)
  decision: ReportDecision;
}
