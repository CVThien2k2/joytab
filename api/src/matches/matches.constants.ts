/**
 * Nguồn sự thật duy nhất cho hằng số của luồng lịch thi đấu.
 */

/** Trạng thái một trận. Lưu VarChar nên đây là nơi duy nhất liệt kê giá trị hợp lệ. */
export const MATCH_STATUSES = ['open', 'settled', 'canceled'] as const;

/** Hành động trong lịch sử vote. */
export const MATCH_VOTE_ACTIONS = ['join', 'cancel'] as const;

/**
 * Chốt cửa huỷ vote: còn dưới ngần này giờ là không rút được nữa.
 *
 * Con số này là một lời hứa với những người còn lại: tới giờ đó, danh sách đã là danh sách
 * thật, ai còn tên là chắc chắn đi — và cũng chính là danh sách bị chia tiền.
 */
export const MATCH_CANCEL_LOCK_HOURS = 2;
export const MATCH_CANCEL_LOCK_MS = MATCH_CANCEL_LOCK_HOURS * 60 * 60 * 1000;

/**
 * Mọi số tiền chia cho từng người đều làm tròn LÊN bội số này (đồng).
 *
 * Làm tròn lên chứ không làm tròn gần nhất: tổng thu khi đó luôn ≥ tổng chi, không bao giờ
 * có cảnh thu đủ mọi người mà vẫn thiếu tiền trả sân. Phần dư hiện thành một dòng riêng.
 */
export const MONEY_ROUNDING_UNIT = 1000;

export const MIN_COURT_NAME_LENGTH = 1;
export const MAX_COURT_NAME_LENGTH = 120;
export const MAX_MATCH_NOTE_LENGTH = 500;

/** 2 người mới thành trận; 100 là trần để một cú nhập nhầm không dựng ra trận 10.000 người. */
export const MIN_MAX_PLAYERS = 2;
export const MAX_MAX_PLAYERS = 100;

/**
 * Hệ số nam so với nữ. Chặn hai đầu vì đây là số owner gõ tay: 0 thì nam đóng 0 đồng và
 * cả trận rơi hết lên vai nữ, còn 10 lần thì không còn là "chia theo giới" nữa.
 */
export const MIN_MALE_RATIO = 0.1;
export const MAX_MALE_RATIO = 10;
/** Decimal(4,2) ở DB — hai chữ số thập phân, không hơn. */
export const MALE_RATIO_DECIMALS = 2;

export const MAX_EXPENSE_LINES = 50;
export const MAX_EXPENSE_NAME_LENGTH = 120;
export const MAX_EXPENSE_QUANTITY = 9999;
/** 100 triệu cho MỘT đơn giá: đủ cho mọi khoản có thật, chặn được số nhập thừa vài số 0. */
export const MAX_EXPENSE_UNIT_PRICE = 100_000_000;

/**
 * Trần khoảng ngày khi hỏi lịch. Bộ lịch chỉ xem một tháng một lần, nên khoảng rộng hơn quý
 * là dấu hiệu của client tự chế đang kéo cả bảng về.
 */
export const MATCH_RANGE_MAX_DAYS = 92;
