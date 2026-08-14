"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMyDebts, usePayments } from "@/hooks/use-billing"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { DebtStatusBadge } from "./debt-status-badge"
import { PayDialog } from "./pay-dialog"

const PAYMENT_STATUS_LABEL = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã duyệt",
  REJECTED: "Bị từ chối",
} as const

/**
 * Input: orgId.
 * Output: Màn công nợ của tôi — từng khoản, tổng, nút báo đã trả, và lịch sử thanh toán.
 */
export function MyDebtsPanel({ orgId }: { orgId: string }) {
  const { data: debts, isPending } = useMyDebts(orgId)
  const { data: payments } = usePayments(orgId, {})
  const [payOpen, setPayOpen] = useState(false)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Công nợ của tôi</CardTitle>
          <CardDescription>
            {debts
              ? `Còn nợ ${formatMoney(debts.remaining)} / tổng ${formatMoney(debts.totalAmount)}`
              : "Đang tải…"}
          </CardDescription>
          {debts && debts.remaining > 0 ? (
            <CardAction>
              <Button onClick={() => setPayOpen(true)}>Báo đã trả</Button>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent>
          {isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : debts && debts.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Buổi đánh</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Phải trả</TableHead>
                  <TableHead>Đã trả</TableHead>
                  <TableHead>Còn lại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.items.map((debt) => (
                  <TableRow key={debt.settlementId}>
                    <TableCell className="font-medium">{debt.eventTitle}</TableCell>
                    <TableCell>{formatDate(debt.eventStartAt)}</TableCell>
                    <TableCell>{formatMoney(debt.amount)}</TableCell>
                    <TableCell>{formatMoney(debt.paidAmount)}</TableCell>
                    <TableCell>{formatMoney(debt.remaining)}</TableCell>
                    <TableCell>
                      <DebtStatusBadge status={debt.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              Bạn chưa có khoản nợ nào. Công nợ xuất hiện sau khi buổi đánh được chốt sổ.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử thanh toán</CardTitle>
          <CardDescription>Các lần bạn báo đã trả tiền.</CardDescription>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời điểm</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Hình thức</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                    <TableCell>{formatMoney(payment.amount)}</TableCell>
                    <TableCell>
                      {payment.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                    </TableCell>
                    <TableCell>{PAYMENT_STATUS_LABEL[payment.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">Chưa có thanh toán nào.</p>
          )}
        </CardContent>
      </Card>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        orgId={orgId}
        remaining={debts?.remaining ?? 0}
      />
    </div>
  )
}
