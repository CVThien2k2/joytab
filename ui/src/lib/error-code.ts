import axios from "axios"

/**
 * Thông báo tiếng Việt theo `code` — hợp đồng ổn định với BE. Cố tình KHÔNG dùng `message`
 * của BE: message có thể đổi hoặc đa ngôn ngữ, còn `code` thì không.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  ORG_001: "Không tìm thấy nhóm",
  ORG_002: "Bạn không thuộc nhóm này",
  ORG_003: "Chỉ quản trị viên mới làm được việc này",
  ORG_004: "Nhóm phải còn ít nhất một quản trị viên",
  ORG_005: "Đã là thành viên của nhóm",
  ORG_006: "Không tìm thấy thành viên",

  INV_001: "Không tìm thấy lời mời",
  INV_002: "Lời mời đã hết hạn, bị thu hồi hoặc hết lượt",

  EVT_001: "Không tìm thấy buổi đánh",
  EVT_002: "Buổi đánh đã đủ người",
  EVT_003: "Đã khoá bình chọn cho buổi này",
  EVT_004: "Buổi đánh không còn mở",
  EVT_005: "Chưa chấm ai thực tế có mặt",
  EVT_006: "Không mở lại được vì đã có người thanh toán",
  TPL_001: "Không tìm thấy lịch định kỳ",

  PAY_001: "Không tìm thấy thanh toán",
  PAY_002: "Thanh toán không còn ở trạng thái chờ duyệt",
  PAY_003: "Phân bổ không khớp số tiền thanh toán",
  PAY_004: "Phân bổ vượt quá số còn nợ",
  SET_001: "Không tìm thấy khoản nợ",

  VALIDATION_001: "Dữ liệu không hợp lệ",
  SYS_001: "Có lỗi xảy ra, thử lại sau",
  SYS_404: "Không tìm thấy dữ liệu",
}

const FALLBACK_MESSAGE = "Có lỗi xảy ra, thử lại sau"

/**
 * Input: Lỗi bất kỳ ném ra từ tầng api.
 * Output: Mã lỗi nghiệp vụ của BE nếu có.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (!axios.isAxiosError(error)) return undefined
  return (error.response?.data as { code?: string } | undefined)?.code
}

/**
 * Input: Lỗi bất kỳ và (tuỳ chọn) các message ghi đè cho riêng màn hình đang dùng.
 * Output: Câu thông báo tiếng Việt để đưa vào toast.
 */
export function getErrorMessage(
  error: unknown,
  overrides?: Record<string, string>,
): string {
  const code = getErrorCode(error)
  if (!code) return FALLBACK_MESSAGE

  return overrides?.[code] ?? MESSAGE_BY_CODE[code] ?? FALLBACK_MESSAGE
}
