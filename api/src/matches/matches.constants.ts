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

export const MIN_COURT_NAME_LENGTH = 1;
export const MAX_COURT_NAME_LENGTH = 120;
export const MAX_MATCH_NOTE_LENGTH = 500;
/**
 * Địa chỉ sân. 255 vì đây là địa chỉ VIẾT TAY để mở bản đồ hay đọc cho tài xế — dài hơn tên sân
 * (số nhà + đường + quận + thành phố) nhưng không phải một trường mô tả.
 */
export const MAX_MATCH_ADDRESS_LENGTH = 255;
/**
 * Số người đăng ký kèm theo mỗi dòng trong danh sách trận.
 *
 * 5 vì thẻ chỉ vẽ được chừng đó avatar chồng lên nhau trước khi thành một vệt tròn không đọc
 * được; phần dư nói bằng con số "+N" lấy từ tổng số người, nên không cần trả về nhiều hơn.
 */
export const MATCH_PARTICIPANT_PREVIEW_LIMIT = 5;

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
 *
 * KHÔNG áp cho lịch sử: ở đó không gửi khoảng ngày nghĩa là xem cả quá khứ, và một lô chỉ
 * `MATCH_HISTORY_DEFAULT_LIMIT` dòng nên không có chuyện kéo cả bảng về.
 */
export const MATCH_RANGE_MAX_DAYS = 92;

/** Một lô lịch sử. 20 đủ phủ hết màn hình cao nhất mà vẫn là một request nhỏ. */
export const MATCH_HISTORY_DEFAULT_LIMIT = 20;
export const MATCH_HISTORY_MAX_LIMIT = 50;

/**
 * Một lô buổi sắp diễn ra. Cùng con số với lịch sử vì cùng một kiểu danh sách cuộn.
 *
 * Danh sách này KHÔNG bị `MATCH_RANGE_MAX_DAYS` chặn: trần đó có để một client tự chế không
 * kéo cả bảng về trong MỘT lần, còn ở đây mỗi lần chỉ 20 dòng và phải cuộn mới có lô sau —
 * nên xem được hết lịch phía trước, xa tới đâu cũng được.
 */
export const MATCH_UPCOMING_DEFAULT_LIMIT = 20;
export const MATCH_UPCOMING_MAX_LIMIT = 50;

/** Hai trạng thái tạo nên lịch sử: đã chốt tiền, hoặc đã huỷ. Trận `open` là việc đang treo. */
export const MATCH_HISTORY_STATUSES = ['settled', 'canceled'] as const;

/**
 * Ba lát cắt của sổ lịch sử TỔ CHỨC (chỉ owner xem):
 *
 *  - `all`: mọi buổi đã là quá khứ — đã chốt giá, đã huỷ, và đã đá xong mà chưa chốt.
 *  - `uncollected`: đã chốt giá nhưng còn người chưa trả. Việc còn phải ĐÒI.
 *  - `unsettled`: đã đá xong mà chưa chốt giá. Việc còn phải LÀM.
 *
 * Hai lát sau là hai việc còn treo của chủ tổ chức, và cũng là lý do trang này tồn tại: tab
 * "Trận của tôi" trả lời "mình còn nợ buổi nào", còn ở đây câu hỏi là "mình còn thiếu việc gì".
 */
export const ORGANIZATION_HISTORY_SCOPES = ['all', 'uncollected', 'unsettled'] as const;

/**
 * Mốc cuộn của lịch sử: `"<start_at ISO>|<match id>"`.
 *
 * BE sinh, FE gửi lại NGUYÊN VĂN — không ai tự dựng chuỗi này. Chốt shape bằng regex ở tầng
 * DTO để service không phải phòng chuỗi rác: sai shape là 400 của ValidationPipe, chứ không
 * phải một `new Date(NaN)` lọt xuống câu query.
 */
export const MATCH_HISTORY_CURSOR_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Mốc cuộn của danh sách buổi sắp tới — cùng shape với lịch sử, chỉ khác chiều đi. */
export const MATCH_UPCOMING_CURSOR_REGEX = MATCH_HISTORY_CURSOR_REGEX;
