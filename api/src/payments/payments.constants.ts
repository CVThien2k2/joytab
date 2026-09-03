/**
 * Nguồn sự thật duy nhất cho hằng số của luồng thanh toán.
 */

/**
 * Trạng thái trả tiền của một khoản. Hai mức, và không có mức nào ở giữa: người trả tự ghi
 * nhận đã chuyển tiền, không ai duyệt.
 */
export const CHARGE_PAYMENT_STATUSES = ['unpaid', 'paid'] as const;

export const MAX_PAYMENT_NOTE_LENGTH = 300;

/**
 * Số khoản tối đa gom vào một lần chuyển khoản. Người chơi 3-4 buổi mới trả một lần, nên
 * con số thật là một chữ số — 100 chỉ để chặn request tự chế.
 */
export const MAX_CHARGES_PER_PAYMENT = 100;

/** URL ảnh chứng từ do chính API upload cấp; giới hạn để không ai nhét cả data-uri vào cột. */
export const MAX_PROOF_URL_LENGTH = 2048;
