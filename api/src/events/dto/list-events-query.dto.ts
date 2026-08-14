import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { EventStatus } from '../../generated/prisma/enums';
import { DEFAULT_EVENT_PAGE_SIZE, MAX_EVENT_PAGE_SIZE } from '../events.constants';

export class ListEventsQueryDto {
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  /** Lọc theo `start_at >= from`. */
  @IsOptional()
  @IsDateString()
  from?: string;

  /** Lọc theo `start_at <= to`. */
  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_EVENT_PAGE_SIZE)
  pageSize?: number = DEFAULT_EVENT_PAGE_SIZE;
}
