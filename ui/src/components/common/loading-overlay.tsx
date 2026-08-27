import { Spinner } from "@/components/ui/spinner"

/**
 * Input: label mô tả việc đang chạy (không có thì chỉ hiện spinner).
 * Output: Lớp phủ kín phần tử cha, chặn tương tác và hiện spinner — dùng cho dialog đang gửi
 *         request. Cùng cách làm với LoadingOverlay của hub.
 *
 *         `absolute inset-0` bám theo cha đã có position (DialogContent là `fixed` nên đủ),
 *         `rounded-[inherit]` để không đè ra ngoài góc bo của dialog.
 *
 *         Đây là lý do nút bấm KHÔNG đổi chữ khi đang chờ: trạng thái chờ nằm ở lớp phủ này,
 *         nút giữ nguyên icon + nhãn nên không co giãn giữa chừng.
 */
export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center rounded-[inherit] bg-popover/70 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="size-7 text-primary" />
        {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      </div>
    </div>
  )
}
