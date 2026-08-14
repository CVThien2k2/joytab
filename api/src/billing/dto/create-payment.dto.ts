import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../generated/prisma/enums';
import { MAX_ALLOCATIONS_PER_PAYMENT, MAX_PAYMENT_AMOUNT } from '../billing.constants';

export class AllocationInputDto {
  @IsUUID('4')
  settlementId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAYMENT_AMOUNT)
  amount!: number;
}

export class CreatePaymentDto {
  /** Chỉ ADMIN được truyền (thu tiền hộ). MEMBER truyền vào cũng bị bỏ qua, luôn là chính mình. */
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAYMENT_AMOUNT)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Bỏ trống = tự phân bổ nợ cũ trước. Truyền vào thì SUM phải khớp đúng `amount`. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ALLOCATIONS_PER_PAYMENT)
  @ValidateNested({ each: true })
  @Type(() => AllocationInputDto)
  allocations?: AllocationInputDto[];
}
