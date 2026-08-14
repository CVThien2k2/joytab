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

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  /** ISO 8601 có offset, vd `2026-08-20T12:00:00+07:00`. */
  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

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

  /** Ghi đè cả mảng, không patch từng phần tử. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExtraCostDto)
  extraCosts?: ExtraCostDto[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PARTICIPANTS_LIMIT)
  maxParticipants!: number;

  /** Số phút trước giờ đánh thì khoá vote; bỏ trống = khoá đúng lúc bắt đầu. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_VOTE_LOCK_MINUTES_BEFORE)
  voteLockMinutesBefore?: number;
}
