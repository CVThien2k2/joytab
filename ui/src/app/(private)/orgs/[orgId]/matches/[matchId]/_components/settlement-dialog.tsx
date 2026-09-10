"use client"

import { useMemo, useState, type ReactNode } from "react"
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
import { Switch } from "@/components/ui/switch"
import { useSettleMatch } from "@/hooks/use-matches-api"
import { formatMoney } from "@/lib/format"
import { splitExpenses } from "@/lib/split"
import { cn } from "@/lib/utils"
import { MAX_EXPENSE_LINES, MAX_MALE_RATIO, MIN_MALE_RATIO } from "@/schema/match"
import { useAuthStore } from "@/stores/auth-store"
import { useActiveOrganization } from "@/stores/organization-store"
import type { MatchDetail, MatchExpense } from "@/types/match"

/** Một dòng đang gõ. Giữ dạng chuỗi vì input trả chuỗi; ép số ở lúc tính và lúc gửi. */
type ExpenseRow = { name: string; quantity: string; unitPrice: string }

const EMPTY_ROW: ExpenseRow = { name: "", quantity: "1", unitPrice: "" }

/**
 * Bề ngang các cột của một dòng chi phí, khai một lần rồi dùng cho cả hàng tiêu đề lẫn từng
 * dòng — hai bảng class rời nhau là hai cột lệch nhau ngay lần sửa đầu tiên.
 *
 * Dưới `sm` là lưới 2 cột ĐỀU nhau: tên trải hết hàng đầu, số lượng và đơn giá chia nhau hàng
 * thứ hai, thành tiền và nút xoá ở hàng cuối. Bảng ngang cứng như trước phải đặt `min-w-500px`,
 * nên trên điện thoại người ta vừa gõ vừa phải kéo ngang. Hai cột `1fr` chứ không `1fr auto`:
 * cột `auto` co theo bề ngang mặc định của ô input nên số lượng và đơn giá rộng lệch hẳn nhau.
 */
const ROW_GRID =
  "grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_8rem_6.5rem_2.25rem] sm:items-center sm:gap-3"

/**
 * Input: nhãn + ô nhập.
 * Output: Ô nhập trong dòng chi phí, kèm nhãn chữ nhỏ CHỈ hiện dưới `sm`.
 *
 *         Hàng tiêu đề của bảng bị ẩn trên điện thoại, nên không có nhãn thì cả dòng chỉ còn
 *         mấy ô trống trông y như nhau — chỉ `aria-label` biết ô nào là số lượng, ô nào là đơn
 *         giá, mà người sáng mắt không đọc được `aria-label`.
 *
 *         Từ `sm` lên, wrapper chuyển sang `display: contents`: nhãn tắt, còn chính ô nhập trở
 *         lại làm ô lưới trực tiếp nên vẫn thẳng cột với hàng tiêu đề. Bọc thêm một lớp div
 *         thật ở đây là lệch cột ngay.
 *
 *         Nhãn `aria-hidden` vì ô nhập đã có `aria-label` cùng nội dung — để cả hai thì trình
 *         đọc màn hình đọc tên ô hai lần.
 */
function RowField({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1 sm:contents", className)}>
      <span className="px-0.5 text-xs text-muted-foreground sm:hidden" aria-hidden="true">
        {label}
      </span>
      {children}
    </div>
  )
}

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
 * Output: Dialog chốt chi phí: nhập các khoản chi, đặt hệ số, xem trước tiền từng người
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
 *         "Chủ tổ chức đã ứng tiền" KHÔNG đổi cách chia — chủ tổ chức vẫn ra một số tiền như
 *         mọi người. Nó chỉ đánh dấu THẲNG khoản của chính họ là đã trả lúc lưu, khỏi phải tự
 *         thanh toán lại cho chính mình. Chỉ hiện khi họ có tên trong trận.
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
  const organization = useActiveOrganization()
  const currentUserId = useAuthStore((state) => state.user?.userId) ?? ""
  // Chỉ có ý nghĩa khi chính chủ tổ chức có tên trong danh sách chia tiền của trận này — họ
  // không chơi trận thì vốn dĩ không có khoản nào của họ để tự đánh dấu.
  const ownerIsParticipant = match.participants.some(
    (participant) => participant.userId === currentUserId,
  )

  const [rows, setRows] = useState<ExpenseRow[]>(() => toRows(initialExpenses))
  const [maleRatio, setMaleRatio] = useState(String(initialMaleRatio))
  // Fill sẵn từ cài đặt tổ chức, owner tự tích/bỏ được ở đây trước khi xác nhận.
  const [skipOwnerPayment, setSkipOwnerPayment] = useState(organization.skipOwnerPayment)

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
          {/* `pr-8` chừa chỗ cho nút đóng ở góc: tên sân dài trên điện thoại xuống hai
              dòng, mà dòng đầu chạy thẳng vào dưới cái dấu X. */}
          <DialogTitle className="pr-8">Chốt chi phí · {match.courtName}</DialogTitle>
          <DialogDescription>
            Nhập các khoản đã chi, đặt hệ số, rồi xem trước số tiền từng người trước khi xác nhận.
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
                    <RowField label="Tên khoản" className="col-span-2">
                      <Input
                        aria-label="Tên khoản"
                        value={row.name}
                        placeholder="Tiền sân"
                        onChange={(event) => updateRow(index, { name: event.target.value })}
                      />
                    </RowField>
                    <RowField label="Số lượng">
                      <Input
                        aria-label="Số lượng"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={row.quantity}
                        onChange={(event) => updateRow(index, { quantity: event.target.value })}
                      />
                    </RowField>
                    {/* Input trần, không `type="number"`: nút tăng/giảm của browser vô dụng ở đây
                        (nhích 1.000đ một lần cho một con số gõ tay), mà lại chiếm chỗ trong ô và
                        đổi số khi lăn chuột lúc đang cuộn hộp thoại. `inputMode` vẫn cho bàn phím
                        số trên điện thoại; lọc bỏ ký tự không phải chữ số để `Number()` ở chỗ
                        tính tiền luôn nhận được số thật. */}
                    <RowField label="Đơn giá">
                      <Input
                        aria-label="Đơn giá"
                        inputMode="numeric"
                        placeholder="120000"
                        value={row.unitPrice}
                        onChange={(event) =>
                          updateRow(index, { unitPrice: event.target.value.replace(/\D/g, "") })
                        }
                      />
                    </RowField>
                    {/* Thành tiền cũng là một ô input để cả hàng thẳng một mạch — chữ trong ô
                        text trần không bao giờ khớp đáy với input bên cạnh. Nhưng `readOnly`:
                        đây là số MÁY nhân ra, gõ vào nó thì gõ vào đâu? Chưa đủ dữ liệu thì để
                        TRỐNG, hiện "0đ" ở mọi dòng mới chỉ là một con số vô nghĩa bắt mắt phải
                        bỏ qua.

                        Nó đi chung wrapper với nút xoá để dưới `sm` hai thứ thành MỘT hàng
                        riêng có nhãn dẫn ở đầu, tách khỏi hai ô vừa gõ bằng một đường kẻ. Từ
                        `sm` lên wrapper là `contents`, chúng về đúng hai cột cuối của lưới. */}
                    <div className="col-span-2 flex items-center gap-2 border-t pt-2 sm:contents">
                      <span
                        className="flex-1 px-0.5 text-xs text-muted-foreground sm:hidden"
                        aria-hidden="true"
                      >
                        Thành tiền
                      </span>
                      <Input
                        aria-label="Thành tiền"
                        readOnly
                        tabIndex={-1}
                        className="w-28 bg-muted/40 text-right text-muted-foreground tabular-nums sm:w-full"
                        value={lineTotal > 0 ? `${formatMoney(lineTotal)}đ` : ""}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="shrink-0 justify-self-end"
                        aria-label="Xoá dòng"
                        disabled={rows.length === 1}
                        onClick={() =>
                          setRows((current) =>
                            current.filter((_row, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
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

          {/* Nhãn và ô nhập trên CÙNG một hàng, chú thích xuống dòng dưới trải hết bề ngang.
              Trước đây cả ba thứ nằm trong một `flex-wrap`: trên điện thoại câu chú thích dài
              chiếm hết hàng nên ô số bị đẩy xuống dòng riêng, đứng lẻ bên trái chẳng còn dính
              vào nhãn nào — mà đây là ô nhập duy nhất của cả khối. */}
          <section className="space-y-1 rounded-xl border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="settle-ratio">Hệ số</Label>
              <Input
                id="settle-ratio"
                type="number"
                step="0.1"
                inputMode="decimal"
                className="w-24 shrink-0"
                value={maleRatio}
                aria-invalid={!ratioValid}
                onChange={(event) => setMaleRatio(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">Giá nam = hệ số × giá nữ</p>
          </section>

          {/* Chỉ hiện khi chính chủ tổ chức có tên trong trận — tích ở đây không đổi cách
              chia, chỉ đánh dấu THẲNG khoản của họ là đã trả nên không cần tự thanh toán
              lại cho chính mình. */}
          {ownerIsParticipant ? (
            <section className="space-y-1 rounded-xl border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="settle-skip-owner-payment">Chủ tổ chức đã ứng tiền</Label>
                <Switch
                  id="settle-skip-owner-payment"
                  checked={skipOwnerPayment}
                  onCheckedChange={setSkipOwnerPayment}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Phần của chủ tổ chức tự động tính là đã trả
              </p>
            </section>
          ) : null}

          <section className="space-y-2">
            <Label>Chia cho {match.participants.length} người</Label>

            {/* Chưa nhập khoản nào thì bảng vẫn hiện, mọi người 0đ — KHÔNG thay bằng một câu
                "nhập ở trên đi". Bảng này là thứ owner cần thấy trước tiên: ai có tên trong
                trận, xếp theo thứ tự nào, hệ số mỗi người là bao nhiêu. Ba câu đó trả lời được
                ngay cả khi chưa có đồng nào, mà giấu bảng đi thì owner gõ xong khoản đầu tiên
                mới biết mình đang chia cho ai — lúc đó phát hiện thiếu người thì đã gõ xong. */}
            {match.participants.length === 0 ? (
              <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                Trận này không có ai đăng ký nên không chia được tiền.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border">
                <ul className="divide-y">
                  {preview.charges.map((charge) => {
                    const participant = participantByUser.get(charge.userId)
                    const name = participant?.fullName ?? "Thành viên"
                    return (
                      <li key={charge.userId} className="flex items-center gap-3 px-3 py-2">
                        <AccountAvatar name={name} src={participant?.avatarUrl} size={28} />
                        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                        {/* Số tiền không đổi — chỉ trạng thái của khoản này đổi lúc lưu. Gắn
                            nhãn ngay đây để owner thấy trước khoản nào sẽ tự thành "đã trả". */}
                        {skipOwnerPayment && charge.userId === currentUserId ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            Đã ứng
                          </span>
                        ) : null}
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

                {/* Dòng chốt sổ: Σ tiền từng người, phải khớp ĐÚNG tổng chi ở trên. Từ khi bỏ
                    làm tròn lên nghìn thì đây là chỗ nhìn một cái biết ngay không đồng nào bị
                    nắn đi đâu — trước kia hai con số này lệch nhau vài nghìn là chuyện thường. */}
                <div className="flex items-center gap-3 border-t bg-muted/40 px-3 py-2">
                  <span className="flex-1 text-sm font-medium">Tổng chia</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(preview.total)}đ
                  </span>
                </div>
              </div>
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
                skipOwnerPayment: ownerIsParticipant && skipOwnerPayment,
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
