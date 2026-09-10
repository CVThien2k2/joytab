"use client"

import { AccountAvatar } from "@/components/common/account-avatar"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

/** Số avatar vẽ ra trước khi phần dư gom vào viên "+N". */
const FACE_LIMIT = 4

/**
 * Input: tên người + có chồng lên mặt trước đó không.
 * Output: Một mặt trong cụm avatar: rê chuột vào thì nó nhấc lên, to ra và bung tên.
 *
 *         Mượn cách của `avatar-group` bên animate-ui, nhưng làm bằng CSS thuần thay vì spring
 *         của motion: dự án này không có thư viện animation nào, mà thêm một cái chỉ để nhấc
 *         một avatar 26px thì không đáng. Đường cong `cubic-bezier(0.34, 1.56, 0.64, 1)` vọt
 *         quá đích một chút rồi lùi lại — đủ để ra cái cảm giác nảy của spring.
 *
 *         `hover:z-20` vì các mặt chồng lên nhau theo thứ tự DOM: không nâng lớp thì mặt đang
 *         phóng to bị chính mặt đứng sau nó cắt mất một góc.
 *
 *         Tên hiện bằng một tooltip tự dựng chứ không dùng `Tooltip` của Radix: nó chỉ là một
 *         nhãn thuần trang trí, mà Radix thì kéo theo portal + provider cho mỗi mặt người
 *         trong mọi hàng của danh sách.
 */
function Face({
  name,
  overlap,
  multiline = false,
  children,
}: {
  name: string
  overlap: boolean
  /** Nhãn dài (danh sách tên) thì cho xuống dòng thay vì kéo tooltip chạy ngang khỏi màn hình. */
  multiline?: boolean
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        "group/face relative z-0 flex transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        "hover:z-20 hover:-translate-y-1 hover:scale-115",
        overlap && "-ml-2",
      )}
    >
      {children}

      <span
        className={cn(
          "pointer-events-none absolute bottom-[calc(100%+7px)] left-1/2 z-30 origin-bottom -translate-x-1/2 translate-y-1 scale-90 rounded-lg border bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground opacity-0 shadow-md transition-all duration-150 ease-out group-hover/face:translate-y-0 group-hover/face:scale-100 group-hover/face:opacity-100",
          multiline ? "w-max max-w-56 text-center leading-snug" : "whitespace-nowrap",
        )}
      >
        {name}
      </span>
    </span>
  )
}

/**
 * Input: vài người đăng ký sớm nhất (BE cắt sẵn) + TỔNG số người + màu nền của khung chứa nó.
 * Output: Cụm avatar chồng lên nhau, phần dư gom vào viên "+N".
 *
 *         `total` tách khỏi `participants` vì hai con số khác nhau: danh sách chỉ có 5 người
 *         đầu, còn "+N" phải tính từ tổng thật. Truyền nhầm `participants.length` vào đây là
 *         một buổi 20 người trông như buổi 5 người.
 *
 *         `ringClass` để viền mỗi avatar ăn theo nền của chỗ đặt nó — trên thẻ là `bg-card`,
 *         trong hộp thoại là `bg-background`. Viền sai màu thì cụm avatar trông như dán đè lên
 *         một mảng khác màu.
 *
 *         Chưa có ai đăng ký thì vẽ một vòng nét đứt "?" thay vì để trống: ô trống ở giữa hàng
 *         đọc thành "chỗ này chưa tải xong", còn vòng nét đứt nói rõ là chưa ai vào.
 *
 *         Truyền vào DANH SÁCH ĐẦY ĐỦ thì viên "+N" biết tên những người còn lại và bung ra khi
 *         rê chuột; truyền vào bản xem trước thì nó chỉ đếm số. Cùng một component, khác nhau ở
 *         chỗ gọi biết bao nhiêu.
 */
export function ParticipantFaces({
  participants,
  total,
  ringClass = "ring-card",
}: {
  participants: MatchSummary["participantsPreview"]
  total: number
  ringClass?: string
}) {
  const faces = participants.slice(0, FACE_LIMIT)
  const overflow = total - faces.length

  // Rê vào viên "+N" thì hiện TÊN những người còn lại — nhưng chỉ khi biết đủ tên. Thẻ trong
  // danh sách chỉ có 5 người đầu (BE cắt sẵn) nên ở đó vế `rest.length === overflow` sai và
  // nhãn lùi về đếm số; hộp thoại xem nhanh tải danh sách đầy đủ nên nó liệt kê được.
  const rest = participants.slice(FACE_LIMIT).map((person) => person.fullName ?? "Thành viên")
  const knowsRest = rest.length === overflow

  return (
    <span
      className="flex items-center"
      aria-label={total > 0 ? `${total} người đã đăng ký` : "Chưa có ai đăng ký"}
    >
      {faces.map((person, index) => (
        <Face key={person.userId} name={person.fullName ?? "Thành viên"} overlap={index > 0}>
          <AccountAvatar
            name={person.fullName ?? "Thành viên"}
            src={person.avatarUrl}
            size={26}
            className={cn("ring-2", ringClass)}
          />
        </Face>
      ))}

      {overflow > 0 ? (
        <Face
          name={knowsRest ? rest.join(", ") : `Và ${overflow} người khác`}
          multiline={knowsRest}
          overlap
        >
          <span
            className={cn(
              "grid size-6.5 place-items-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground ring-2",
              ringClass,
            )}
          >
            +{overflow}
          </span>
        </Face>
      ) : null}

      {total === 0 ? (
        <Face name="Chưa có ai đăng ký" overlap={false}>
          <span className="grid size-6.5 place-items-center rounded-full border border-dashed border-border font-mono text-[10px] font-bold text-muted-foreground">
            ?
          </span>
        </Face>
      ) : null}
    </span>
  )
}
