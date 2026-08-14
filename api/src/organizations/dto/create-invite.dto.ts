import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { INVITE_MAX_EXPIRES_IN_DAYS, INVITE_MAX_USES_LIMIT } from '../organizations.constants';

/**
 * MVP chỉ tạo invite LINK nên DTO không có `type`/`email` — cột trong DB đã có sẵn để bật
 * EMAIL sau mà không phải migrate.
 */
export class CreateInviteDto {
  /** Bỏ trống = link không bao giờ hết hạn. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INVITE_MAX_EXPIRES_IN_DAYS)
  expiresInDays?: number;

  /** Bỏ trống = không giới hạn lượt dùng. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INVITE_MAX_USES_LIMIT)
  maxUses?: number;
}
