"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSettleMatch } from "@/hooks/use-matches-api"
import { formatMoney } from "@/lib/format"
import { splitExpenses } from "@/lib/split"
import { MAX_EXPENSE_LINES, MAX_MALE_RATIO, MIN_MALE_RATIO } from "@/schema/match"
import type { MatchDetail, MatchExpense } from "@/types/match"

/** Một dòng đang gõ. Giữ dạng chuỗi vì input trả chuỗi; ép số ở lúc tính và lúc gửi. */
type ExpenseRow = { name: string; quantity: string; unitPrice: string }

const EMPTY_ROW: ExpenseRow = { name: "", quantity: "1", unitPrice: "" }

/**
 * Bề ngang các cột của một dòng chi phí, khai một lần rồi dùng cho cả hàng tiêu đề lẫn từng
 * dòng — hai bảng class rời nhau là hai cột lệch nhau ngay lần sửa đầu tiên.
 *
 * Dưới `sm` là lưới 2 cột: tên trải hết hàng đầu, số lượng và đơn giá chia nhau hàng thứ hai,
 * thành tiền và nút xoá ở hàng cuối. Bảng ngang cứng như trước phải đặt `min-w-500px`, nên trên
 * điện thoại người ta vừa gõ vừa phải kéo ngang.
 */
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_8rem_6.5rem_2.25rem] sm:items-center sm:gap-3"

function toRows(expenses: MatchExpense[]): ExpenseRow[] {
  if (expenses.length === 0) return [{ ...EMPTY_ROW }]
  return expenses.map((expense) => ({
    name: expense.name,
    quantity: String(expense.quantity),
    unitPrice: String(expense.unitPrice),
  }))
}

/**
 * Input: trận (đã có danh sách người tham gia) + bảng chi phí cũ nếu đang sửa.
 * Output: Dialog chốt chi phí: nhập các khoản chi, đặt hệ số nam, xem trước tiền từng người
 *         rồi xác nhận.
 *
 *         Ba khối theo đúng thứ tự người ta làm: chi những gì → chia theo hệ số nào → ai trả
 *         bao nhiêu. Khối cuối chỉ để ĐỌC, nên nó nằm dưới hai khối gõ chứ không xen vào giữa.
 *
 *         Bảng preview tính NGAY tại client bằng đúng công thức của BE (lib/split.ts) để gõ
 *         tới đâu thấy tới đó. Nhưng con số được LƯU luôn là con số BE tính lại khi xác nhận —
 *         client không quyết định tiền.
 *
 *         Ô "chi phí" là ĐƠN GIÁ, cột thành tiền hiện ngay bên cạnh: mua 10 chai nước thì nhập
 *         giá một chai là tự nhiên, còn nhân nhẩm rồi gõ tổng là chỗ dễ sai nhất.
 *
 *         Ruột cuộn trong `DialogBody`, không cuộn cả hộp: bảng chia tiền cho 12 người thì dài
 *         hơn màn hình, mà cuộn cả hộp là nút "Xác nhận" trôi ra ngoài khung hình.
 *
 *         State các dòng chi nạp từ props lúc MOUNT và không đồng bộ lại sau đó — chỗ gọi phải
 *         đổi `key` mỗi lần mở để component dựng lại với dữ liệu mới nhất (xem SettlementSection).
 *         Cách này thay cho một effect reset theo `open`: hộp thoại vẫn nằm sẵn trong cây để có
 *         animation đóng/mở, mà không phải set state trong effect.
 */
export function SettlementDialog({
  match,
  organizationId,
  open,
  onOpenChange,
  initialExpenses,
  initialMaleRatio,
}: {
  match: MatchDetail
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initialExpenses: MatchExpense[]
  initialMaleRatio: number
}) {
  const [rows, setRows] = useState<ExpenseRow[]>(() => toRows(initialExpenses))
  const [maleRatio, setMaleRatio] = useState(String(initialMaleRatio))

  const settle = useSettleMatch(organizationId, match.id, () => onOpenChange(false))

  const ratioNumber = Number(maleRatio)
  const ratioValid =
    Number.isFinite(ratioNumber) && ratioNumber >= MIN_MALE_RATIO && ratioNumber <= MAX_MALE_RATIO

  const preview = useMemo(() => {
    const expenses = rows.map((row) => ({
      quantity: Number(row.quantity) || 0,
      unitPrice: Number(row.unitPrice) || 0,
    }))
    return splitExpenses({
      participants: match.participants.map((participant) => ({
        userId: participant.userId,
        gender: participant.gender,
      })),
      expenses,
      maleRatio: ratioValid ? ratioNumber : 1,
    })
  }, [rows, match.participants, ratioValid, ratioNumber])

  const participantByUser = useMemo(
    () => new Map(match.participants.map((participant) => [participant.userId, participant])),
    [match.participants],
  )

  function updateRow(index: number, patch: Partial<ExpenseRow>): void {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  const canSubmit =
    ratioValid &&
    preview.total > 0 &&
    match.participants.length > 0 &&
    rows.every((row) => row.name.trim() && Number(row.quantity) > 0 && row.unitPrice !== "")

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (settle.isPending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        {settle.isPending ? <LoadingOverlay label="Đang chốt chi phí" /> : null}

        <DialogHeader>
          <DialogTitle>Chốt chi phí · {match.courtName}</DialogTitle>
          <DialogDescription>
            Nhập các khoản đã chi, hệ số nam so với nữ, rồi xem trước số tiền từng người trước khi
            xác nhận.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5 py-1">
          <section className="space-y-2">
            <Label>Các khoản chi</Label>

            <div className={`${ROW_GRID} hidden px-1 text-xs text-muted-foreground sm:grid`}>
              <span>Tên khoản</span>
              <span>Số lượng</span>
              <span>Đơn giá</span>
              <span className="text-right">Thành tiền</span>
              <span />
            </div>

            <div className="space-y-2 sm:space-y-1.5">
              {rows.map((row, index) => {
                const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)
                return (
                  <div
                    key={index}
                    className={`${ROW_GRID} rounded-xl border p-2 sm:rounded-none sm:border-0 sm:p-0`}
                  >
                    <Input
                      aria-label="Tên khoản"
                      className="col-span-2 sm:col-span-1"
                      value={row.name}
                      placeholder="Tiền sân"
                      onChange={(event) => updateRow(index, { name: event.target.value })}
                    />
                    <Input
                      aria-label="Số lượng"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={row.quantity}
                      onChange={(event) => updateRow(index, { quantity: event.target.value })}
                    />
                    {/* Input trần, không `type="number"`: nút tăng/giảm của browser vô dụng ở đây
                        (nhích 1.000đ một lần cho một con số gõ tay), mà lại chiếm chỗ trong ô và
                        đổi số khi lăn chuột lúc đang cuộn hộp thoại. `inputMode` vẫn cho bàn phím
                        số trên điện thoại; lọc bỏ ký tự không phải chữ số để `Number()` ở chỗ
                        tính tiền luôn nhận được số thật. */}
                    <Input
                      aria-label="Đơn giá"
                      inputMode="numeric"
                      placeholder="120000"
                      value={row.unitPrice}
                      onChange={(event) =>
                        updateRow(index, { unitPrice: event.target.value.replace(/\D/g, "") })
                      }
                    />
                    {/* Cũng là một ô input để cả hàng thẳng một mạch — chữ trong ô text trần
                        không bao giờ khớp đáy với input bên cạnh. Nhưng `readOnly`: đây là số
                        MÁY nhân ra, gõ vào nó thì gõ vào đâu? Chưa đủ dữ liệu thì để TRỐNG, hiện
                        "0đ" ở mọi dòng mới chỉ là một con số vô nghĩa bắt mắt phải bỏ qua. */}
                    <Input
                      aria-label="Thành tiền"
                      readOnly
                      tabIndex={-1}
                      className="bg-muted/40 text-muted-foreground tabular-nums sm:text-right"
                      value={lineTotal > 0 ? `${formatMoney(lineTotal)}đ` : ""}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="justify-self-end"
                      aria-label="Xoá dòng"
                      disabled={rows.length === 1}
                      onClick={() =>
                        setRows((current) => current.filter((_row, rowIndex) => rowIndex !== index))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length >= MAX_EXPENSE_LINES}
                onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
              >
                <Plus aria-hidden="true" />
                Thêm khoản
              </Button>
              <p className="text-sm text-muted-foreground">
                Tổng chi{" "}
                <span className="text-base font-bold text-foreground tabular-nums">
                  {formatMoney(preview.total)}đ
                </span>
              </p>
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="settle-ratio" className="shrink-0">
                Hệ số nam
              </Label>
              <Input
                id="settle-ratio"
                type="number"
                step="0.1"
                inputMode="decimal"
                className="w-24"
                value={maleRatio}
                aria-invalid={!ratioValid}
                onChange={(event) => setMaleRatio(event.target.value)}
              />
            </div>
            <p className="min-w-50 flex-1 text-xs text-muted-foreground">
              Nữ là mốc 1. Hệ số {ratioValid ? ratioNumber : "1.2"} nghĩa là nam đóng gấp{" "}
              {ratioValid ? ratioNumber : "1.2"} lần nữ. Người chưa khai giới tính tính như nam.
            </p>
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Chia cho {match.participants.length} người</Label>
              {preview.surplus > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Làm tròn lên nghìn nên thu dư {formatMoney(preview.surplus)}đ vào quỹ
                </span>
              ) : null}
            </div>

            {match.participants.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Trận này không có ai đăng ký nên không chia được tiền.
              </p>
            ) : preview.total === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Nhập khoản chi ở trên để xem trước tiền từng người.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {preview.charges.map((charge) => {
                  const participant = participantByUser.get(charge.userId)
                  const name = participant?.fullName ?? "Thành viên"
                  return (
                    <li key={charge.userId} className="flex items-center gap-3 px-3 py-2">
                      <AccountAvatar name={name} src={participant?.avatarUrl} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        ×{charge.ratio}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatMoney(charge.amount)}đ
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </DialogBody>

        <DialogFooter>
          <p className="mr-auto hidden self-center text-xs text-muted-foreground sm:block">
            {formatMoney(preview.total)}đ cho {match.participants.length} người
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={settle.isPending}
            onClick={() => onOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            disabled={!canSubmit || settle.isPending}
            onClick={() =>
              settle.mutate({
                maleRatio: ratioNumber,
                expenses: rows.map((row) => ({
                  name: row.name.trim(),
                  quantity: Number(row.quantity),
                  unitPrice: Number(row.unitPrice),
                })),
              })
            }
          >
            Xác nhận chia tiền
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
