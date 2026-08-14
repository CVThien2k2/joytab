import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsUUID, ValidateNested } from 'class-validator';
import { MAX_PARTICIPANTS_LIMIT } from '../events.constants';

export class AttendedItemDto {
  @IsUUID('4')
  userId!: string;

  @IsBoolean()
  attended!: boolean;
}

/** Chấm điểm danh thực tế hàng loạt sau buổi đánh. Chỉ người `attended = true` mới bị chia tiền. */
export class MarkAttendedDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PARTICIPANTS_LIMIT)
  @ValidateNested({ each: true })
  @Type(() => AttendedItemDto)
  items!: AttendedItemDto[];
}
