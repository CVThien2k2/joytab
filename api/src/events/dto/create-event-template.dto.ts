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

export class CreateEventTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  /** ISO-8601: 1 = thứ Hai … 7 = Chủ nhật. */
  @Type(() => Number)
  @IsInt()
  @Min(MIN_DAY_OF_WEEK)
  @Max(MAX_DAY_OF_WEEK)
  dayOfWeek!: number;

  @Matches(TIME_OF_DAY_PATTERN, { message: 'startTime must be HH:mm or HH:mm:ss' })
  startTime!: string;

  /** `endTime <= startTime` hiểu là buổi vắt qua nửa đêm. */
  @Matches(TIME_OF_DAY_PATTERN, { message: 'endTime must be HH:mm or HH:mm:ss' })
  endTime!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  locationName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  locationAddress?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_COST_AMOUNT)
  courtCost!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PARTICIPANTS_LIMIT)
  maxParticipants!: number;

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
