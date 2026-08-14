import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_COST_AMOUNT, MAX_PARTICIPANTS_LIMIT, MAX_VOTE_LOCK_MINUTES_BEFORE } from '../events.constants';
import { ExtraCostDto } from './extra-cost.dto';

/** Mọi field tuỳ chọn; field không truyền thì giữ nguyên. */
export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  locationAddress?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_COST_AMOUNT)
  courtCost?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExtraCostDto)
  extraCosts?: ExtraCostDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PARTICIPANTS_LIMIT)
  maxParticipants?: number;

  /**
   * Đổi mốc khoá vote. Tính lại từ `startAt` mới nếu có, không thì từ `startAt` đang lưu —
   * dời giờ đánh mà quên dời mốc khoá là bẫy dễ dính nhất.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VOTE_LOCK_MINUTES_BEFORE)
  voteLockMinutesBefore?: number;
}
