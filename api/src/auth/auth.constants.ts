/**
 * Nguồn sự thật duy nhất cho mọi hằng số cấu hình của luồng auth JWT.
 */

const MS_PER_SECOND = 1000;

// ===== TTL token =====
/**
 * Access token sống 1 giờ và stateless — không tra DB. Đây cũng chính là cửa sổ mà việc
 * thu hồi CHƯA có hiệu lực: logout hoặc revoke RT chỉ chặn được refresh, còn AT đang cầm
 * vẫn dùng được tới khi hết hạn.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** Refresh token sống 7 ngày, reset lại mỗi lần rotate (trượt theo hoạt động của user). */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * MS_PER_SECOND;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * MS_PER_SECOND;

// ===== Độ dài refresh token ngẫu nhiên (bytes) =====
/** 32 bytes random → 64 ký tự hex. Đủ entropy để hash SHA-256 trần không cần salt/KDF. */
export const REFRESH_TOKEN_BYTES = 32;

// ===== Cookie =====
export const ACCESS_COOKIE_NAME = 'at';
export const REFRESH_COOKIE_NAME = 'rt';
/**
 * Cookie báo "user này CHƯA onboarding xong". Chỉ tồn tại khi còn thiếu thông tin — có mặt
 * là proxy của FE đẩy về /onboarding, không có là cho vào app.
 *
 * Vẫn httpOnly như at/rt: proxy chạy trên Next server nên đọc được cookie httpOnly, còn JS
 * client thì không cần (và không nên) sửa được cờ này. Nó là gợi ý điều hướng chứ không phải
 * nguồn sự thật — nguồn sự thật là cột `users.onboarded`, BE set lại cookie ở mọi lần
 * login/refresh/onboarding nên cookie bị xoá tay chỉ khiến user đi sai một nhịp rồi tự đúng.
 */
export const ONBOARDING_COOKIE_NAME = 'onb';
/** Giá trị duy nhất của cookie `onb`: có cookie = đang chờ onboarding. */
export const ONBOARDING_PENDING_VALUE = '1';
/** Cookie auth phải được gửi cho mọi route nên dùng path '/'. */
export const COOKIE_PATH = '/';

// ===== Ràng buộc dữ liệu onboarding (BE là nguồn sự thật, FE mirror lại để validate sớm) =====
/** Dưới 13 tuổi không mở tài khoản; 120 là chặn trên cho dữ liệu rác. */
export const MIN_USER_AGE = 13;
export const MAX_USER_AGE = 120;
export const MIN_FULL_NAME_LENGTH = 2;
export const MAX_FULL_NAME_LENGTH = 100;
/**
 * SĐT di động Việt Nam sau khi chuẩn hoá về 10 số bắt đầu bằng 0.
 * Đầu số theo quy hoạch hiện hành: Viettel 032-039/086/096-098, Vinaphone 081-085/088/091/094,
 * Mobifone 070/076-079/089/090/093, Vietnamobile 052/056/058/092, Gmobile 059/099, iTel 087.
 * Cố tình KHÔNG nhận số cố định (024, 028...): đây là số để liên lạc với chủ tài khoản.
 */
export const VN_MOBILE_PHONE_REGEX = /^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-46-9])\d{7}$/;

// ===== Claim `typ` trong access token =====
/** Chỉ AT là JWT nên chỉ có một loại; giữ claim để token lạ cùng secret vẫn bị từ chối. */
export const ACCESS_TOKEN_TYPE = 'at';

// ===== Rate limit (áp ở AuthController) =====
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;

// ===== FE origin fallback khi thiếu env FRONTEND_ORIGIN =====
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
