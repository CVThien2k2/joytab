/**
 * Nguồn sự thật duy nhất cho hằng số của luồng thanh toán.
 */

/** Trạng thái một lần chuyển khoản. Lưu VarChar nên đây là nơi duy nhất liệt kê. */
export const PAYMENT_STATUSES = ['submitted', 'confirmed', 'rejected'] as const;

/** Trạng thái trả tiền của một khoản. */
export const CHARGE_PAYMENT_STATUSES = ['unpaid', 'submitted', 'confirmed'] as const;

export const MAX_PAYMENT_NOTE_LENGTH = 300;

/**
 * Owner PHẢI nói vì sao khi báo chưa nhận được: user chỉ có một thao tác là GỬI, không tự rút
 * lại được, nên lý do là thứ duy nhất giúp họ biết phải làm gì tiếp.
 */
export const MAX_REJECT_REASON_LENGTH = 300;

/**
 * Số khoản tối đa gom vào một lần chuyển khoản. Người chơi 3-4 buổi mới trả một lần, nên
 * con số thật là một chữ số — 100 chỉ để chặn request tự chế.
 */
export const MAX_CHARGES_PER_PAYMENT = 100;

/** URL ảnh chứng từ do chính API upload cấp; giới hạn để không ai nhét cả data-uri vào cột. */
export const MAX_PROOF_URL_LENGTH = 2048;
