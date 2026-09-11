/**
 * Input: Chuỗi cần chép.
 * Output: `true` nếu đã vào clipboard, `false` nếu không.
 *
 *         KHÔNG ném: mọi nơi gọi đều đang ở giữa một thao tác của người dùng (bấm nút chép),
 *         và thất bại ở đây không phải sự cố — `navigator.clipboard` chỉ tồn tại trong secure
 *         context, nên mở app qua http trên máy khác trong mạng LAN là hỏng hoàn toàn bình
 *         thường. Nơi gọi quyết định nói gì với người dùng; hàm này chỉ trả lời được hay không.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    return false
  }
}

/**
 * Input: Mã tham gia của tổ chức.
 * Output: Liên kết mời đầy đủ, dựng từ chính origin đang mở.
 *
 *         Dựng lúc gọi chứ không lấy từ env: app chạy ở localhost, LAN hay domain thật đều ra
 *         đúng liên kết của nơi người dùng đang đứng. Chỉ gọi được ở client.
 */
export function buildInviteLink(joinCode: string): string {
  return `${window.location.origin}/join/${joinCode}`
}
