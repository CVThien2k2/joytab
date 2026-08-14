import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentStatus } from '../../generated/prisma/enums';

export class ListPaymentsQueryDto {
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  /** Chỉ ADMIN dùng được; MEMBER luôn bị ép về chính mình bất kể truyền gì. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;
}
