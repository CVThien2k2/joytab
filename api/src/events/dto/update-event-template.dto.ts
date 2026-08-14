import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import {
  MAX_COST_AMOUNT,
  MAX_DAY_OF_WEEK,
  MAX_PARTICIPANTS_LIMIT,
  MAX_VOTE_LOCK_MINUTES_BEFORE,
  MIN_DAY_OF_WEEK,
  TIME_OF_DAY_PATTERN,
} from '../events.constants';

/**
 * Mọi field đều tuỳ chọn; field không truyền thì giữ nguyên giá trị cũ.
 *
 * Viết tay thay vì `PartialType`: `@nestjs/mapped-types` là dependency mới chỉ để tiết kiệm
 * một file DTO — không đáng.
 *
 * Sửa template KHÔNG ảnh hưởng các buổi đã sinh: chúng đã copy đủ dữ liệu và sống độc lập.
 */
export class UpdateEventTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DAY_OF_WEEK)
  @Max(MAX_DAY_OF_WEEK)
  dayOfWeek?: number;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime?: string;

  @IsOptional()
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime?: string;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PARTICIPANTS_LIMIT)
  maxParticipants?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VOTE_LOCK_MINUTES_BEFORE)
  voteLockMinutesBefore?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
