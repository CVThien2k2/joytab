import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import {
  MAX_CHARGES_PER_PAYMENT,
  MAX_PAYMENT_NOTE_LENGTH,
  MAX_PROOF_URL_LENGTH,
  MAX_REJECT_REASON_LENGTH,
  PAYMENT_STATUSES,
} from './payments.constants';

/** Param của mọi route thanh toán — đều lồng dưới một tổ chức vì QR là của tổ chức. */
export class PaymentOrganizationParamDto {
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  organizationId: string;
}

/** Param của các route thao tác lên một lần thanh toán. */
export class PaymentParamDto {
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  organizationId: string;

  @IsUUID(undefined, { message: 'Id lần thanh toán không hợp lệ' })
  paymentId: string;
}

/**
 * Body của POST /organizations/:organizationId/payments.
 *
 * Gửi danh sách khoản chứ không phải số tiền: số tiền là thứ BE tự cộng từ các khoản được
 * chọn. Client gửi số tiền lên thì đó là số tiền client tự khai.
 */
export class CreatePaymentDto {
  @IsArray({ message: 'Danh sách khoản không hợp lệ' })
  @ArrayMinSize(1, { message: 'Chưa chọn khoản nào để thanh toán' })
  @ArrayMaxSize(MAX_CHARGES_PER_PAYMENT, {
    message: `Tối đa ${MAX_CHARGES_PER_PAYMENT} khoản trong một lần thanh toán`,
  })
  @IsUUID(undefined, { each: true, message: 'Id khoản không hợp lệ' })
  chargeIds: string[];

  /** Bắt buộc: không có nhánh tiền mặt, nên không ảnh là owner không có gì để đối soát. */
  @IsUrl({ require_tld: false }, { message: 'Ảnh chuyển khoản không hợp lệ' })
  @MaxLength(MAX_PROOF_URL_LENGTH, { message: 'Đường dẫn ảnh quá dài' })
  proofUrl: string;

  @IsOptional()
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Ghi chú không hợp lệ' })
  @MaxLength(MAX_PAYMENT_NOTE_LENGTH, {
    message: `Ghi chú tối đa ${MAX_PAYMENT_NOTE_LENGTH} ký tự`,
  })
  note?: string;
}

/** Body của POST .../payments/:paymentId/reject. Lý do là BẮT BUỘC. */
export class RejectPaymentDto {
  @Transform(({ value }): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Lý do không hợp lệ' })
  @Length(1, MAX_REJECT_REASON_LENGTH, {
    message: `Lý do từ 1 đến ${MAX_REJECT_REASON_LENGTH} ký tự`,
  })
  reason: string;
}

/**
 * Query của GET /organizations/:organizationId/payments.
 *
 * Owner lọc theo trạng thái để làm hàng đợi duyệt; member gửi gì thì gửi, service vẫn chỉ
 * trả các lần thanh toán của chính họ.
 */
export class ListPaymentsQueryDto {
  @IsOptional()
  @Type(() => String)
  @IsIn(PAYMENT_STATUSES, { message: 'Trạng thái không hợp lệ' })
  status?: (typeof PAYMENT_STATUSES)[number];
}
