import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator';
import { MAX_CHARGES_PER_PAYMENT, MAX_PAYMENT_NOTE_LENGTH, MAX_PROOF_URL_LENGTH } from './payments.constants';

/** Param của mọi route thanh toán — đều lồng dưới một tổ chức vì QR là của tổ chức. */
export class PaymentOrganizationParamDto {
  @IsUUID(undefined, { message: 'Id tổ chức không hợp lệ' })
  organizationId: string;
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

  /** Bắt buộc: không có nhánh tiền mặt, nên không ảnh là cả nhóm không có gì để đối chiếu. */
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
