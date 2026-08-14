import { IsEnum } from 'class-validator';
import { AttendanceStatus } from '../../generated/prisma/enums';

/** Chỉ có GOING / NOT_GOING — không có WAITLIST, xem quyết định §2 của spec. */
export class UpsertAttendanceDto {
  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;
}
