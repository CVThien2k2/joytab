import type { Gender } from "@/types/onboarding"

/**
 * Nhãn tiếng Việt của giới tính.
 *
 * Khai MỘT chỗ vì có nhiều màn hình cùng đọc ra ba chữ này (danh sách người tham gia, bản xem
 * nhanh hồ sơ). Ba bản chép tay là ba chỗ sẽ trôi mỗi cái một kiểu — mà đây là thứ chỉ cần lệch
 * một chữ ("Khác" với "Không nói") là hai màn hình trông như đang nói về hai trường khác nhau.
 *
 * Không gộp luôn danh sách lựa chọn của form vào đây: form cần THỨ TỰ hiện và cần cả những
 * trạng thái không phải giới tính (chuỗi rỗng cho "chưa chọn"), nên nó là một cấu trúc khác.
 */
export const GENDER_LABELS: Record<Gender, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
}

/**
 * Input: giới tính đã lưu (`null` với user chưa khai).
 * Output: Nhãn để hiện, hoặc `null` khi chưa có gì để hiện — chỗ gọi tự quyết định nói gì vào
 *         khoảng trống đó, vì "chưa khai" ở mỗi màn hình đọc ra một câu khác nhau.
 */
export function genderLabel(gender: Gender | null | undefined): string | null {
  return gender ? GENDER_LABELS[gender] : null
}
