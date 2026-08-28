"use client"

import { useMemo, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { useSettleMatch } from "@/hooks/use-matches-api"
import { formatMoney } from "@/lib/format"
import { splitExpenses } from "@/lib/split"
import { MAX_EXPENSE_LINES, MAX_MALE_RATIO, MIN_MALE_RATIO } from "@/schema/match"
import type { MatchDetail, MatchExpense } from "@/types/match"

/** Một dòng đang gõ. Giữ dạng chuỗi vì input trả chuỗi; ép số ở lúc tính và lúc gửi. */
type ExpenseRow = { name: string; quantity: string; unitPrice: string }

const EMPTY_ROW: ExpenseRow = { name: "", quantity: "1", unitPrice: "" }

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
 *         Bảng preview tính NGAY tại client bằng đúng công thức của BE (lib/split.ts) để gõ
 *         tới đâu thấy tới đó. Nhưng con số được LƯU luôn là con số BE tính lại khi xác nhận —
 *         client không quyết định tiền.
 *
 *         Ô "chi phí" là ĐƠN GIÁ, cột thành tiền hiện ngay bên cạnh: mua 10 chai nước thì nhập
 *         giá một chai là tự nhiên, còn nhân nhẩm rồi gõ tổng là chỗ dễ sai nhất.
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

  const nameByUser = new Map(
    match.participants.map((participant) => [participant.userId, participant.fullName]),
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
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        {settle.isPending ? <LoadingOverlay label="Đang chốt chi phí" /> : null}

        <DialogHeader>
          <DialogTitle>Chốt chi phí · {match.courtName}</DialogTitle>
          <DialogDescription>
            Nhập các khoản đã chi, hệ số nam so với nữ, rồi xem trước số tiền từng người trước khi
            xác nhận.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Các khoản chi</Label>
            <div className="overflow-x-auto">
              <table className="w-full min-w-125 text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Tên khoản</th>
                    <th className="w-24 pb-2 font-medium">Số lượng</th>
                    <th className="w-36 pb-2 font-medium">Đơn giá</th>
                    <th className="w-32 pb-2 text-right font-medium">Thành tiền</th>
                    <th className="w-10 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const lineTotal = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)
                    return (
                      <tr key={index}>
                        <td className="py-1 pr-2">
                          <Input
                            value={row.name}
                            placeholder="Tiền sân"
                            onChange={(event) => updateRow(index, { name: event.target.value })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={row.quantity}
                            onChange={(event) => updateRow(index, { quantity: event.target.value })}
                          />
                        </td>
                        <td className="py-1 pr-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1000}
                            placeholder="120000"
                            value={row.unitPrice}
                            onChange={(event) =>
                              updateRow(index, { unitPrice: event.target.value })
                            }
                          />
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {formatMoney(lineTotal)}đ
                        </td>
                        <td className="py-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
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
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={rows.length >= MAX_EXPENSE_LINES}
                onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
              >
                <Plus className="size-4" aria-hidden="true" />
                Thêm khoản
              </Button>
              <p className="text-sm">
                Tổng chi: <span className="font-bold tabular-nums">{formatMoney(preview.total)}đ</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
            <div className="space-y-1">
              <Label htmlFor="settle-ratio">Hệ số nam</Label>
              <Input
                id="settle-ratio"
                type="number"
                step="0.1"
                inputMode="decimal"
                className="w-32"
                value={maleRatio}
                aria-invalid={!ratioValid}
                onChange={(event) => setMaleRatio(event.target.value)}
              />
            </div>
            <p className="flex-1 text-xs text-muted-foreground">
              Nữ là mốc 1. Hệ số {ratioValid ? ratioNumber : "1.2"} nghĩa là nam đóng gấp{" "}
              {ratioValid ? ratioNumber : "1.2"} lần nữ. Người chưa khai giới tính tính như nam.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Chia cho {match.participants.length} người</Label>
            <ul className="divide-y rounded-lg border">
              {preview.charges.map((charge) => (
                <li key={charge.userId} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {nameByUser.get(charge.userId) ?? "Thành viên"}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">×{charge.ratio}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(charge.amount)}đ
                  </span>
                </li>
              ))}
            </ul>
            {preview.surplus > 0 ? (
              <p className="text-xs text-muted-foreground">
                Làm tròn lên nghìn nên thu dư{" "}
                <span className="font-semibold">{formatMoney(preview.surplus)}đ</span> — phần này
                vào quỹ.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
