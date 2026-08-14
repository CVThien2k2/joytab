"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useConfirmPayment,
  useOrgDebts,
  usePayments,
  useRejectPayment,
} from "@/hooks/use-billing"
import { formatDateTime, formatMoney } from "@/lib/format"
import type { PaymentStatus } from "@/types/billing"
import { PayDialog } from "../../debts/_components/pay-dialog"

type StatusFilter = PaymentStatus | "ALL"

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "CONFIRMED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Bị từ chối" },
  { value: "ALL", label: "Tất cả" },
]

const STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "destructive"> = {
  PENDING: "default",
  CONFIRMED: "secondary",
  REJECTED: "destructive",
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Chờ duyệt",
  CONFIRMED: "Đã duyệt",
  REJECTED: "Bị từ chối",
}

/**
 * Input: orgId.
 * Output: Màn quản trị thanh toán — hàng đợi duyệt + bảng công nợ toàn nhóm.
 *
 * Duyệt xong BE mới cộng vào công nợ, và nó validate lại phân bổ ngay lúc đó: khoản nợ có
 * thể đã được trả bởi thanh toán khác trong lúc chờ, khi ấy duyệt sẽ báo PAY_004.
 */
export function PaymentsPanel({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<StatusFilter>("PENDING")
  const filters = status === "ALL" ? {} : { status }
  const { data: payments, isPending } = usePayments(orgId, filters)
  const { data: debts } = useOrgDebts(orgId, true)
  const confirmPayment = useConfirmPayment(orgId)
  const rejectPayment = useRejectPayment(orgId)
  const [collecting, setCollecting] = useState<{ userId: string; name: string; remaining: number } | null>(null)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Thanh toán</CardTitle>
          <CardDescription>
            Duyệt các khoản thành viên báo đã trả.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(value as StatusFilter)}
          >
            <TabsList>
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người trả</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Hình thức</TableHead>
                  <TableHead>Phân bổ</TableHead>
                  <TableHead>Gửi lúc</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="w-40" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.userFullName ?? payment.userEmail}
                    </TableCell>
                    <TableCell>{formatMoney(payment.amount)}</TableCell>
                    <TableCell>
                      {payment.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {payment.allocations
                        .map(
                          (allocation) =>
                            `${allocation.eventTitle}: ${formatMoney(allocation.amount)}`,
                        )
                        .join(" · ")}
                    </TableCell>
                    <TableCell>{formatDateTime(payment.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[payment.status]}>
                        {STATUS_LABEL[payment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payment.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={confirmPayment.isPending}
                            onClick={() => confirmPayment.mutate(payment.id)}
                          >
                            Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={rejectPayment.isPending}
                            onClick={() => rejectPayment.mutate(payment.id)}
                          >
                            Từ chối
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              Không có thanh toán nào ở trạng thái này.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Công nợ toàn nhóm</CardTitle>
          <CardDescription>
            Thu tiền mặt tại sân thì bấm &quot;Thu tiền&quot; — ghi nhận và duyệt luôn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debts ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thành viên</TableHead>
                  <TableHead>Tổng phải trả</TableHead>
                  <TableHead>Đã trả</TableHead>
                  <TableHead>Còn nợ</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => (
                  <TableRow key={debt.userId}>
                    <TableCell className="font-medium">
                      {debt.fullName ?? debt.email}
                    </TableCell>
                    <TableCell>{formatMoney(debt.totalAmount)}</TableCell>
                    <TableCell>{formatMoney(debt.totalPaid)}</TableCell>
                    <TableCell>{formatMoney(debt.remaining)}</TableCell>
                    <TableCell>
                      {debt.remaining > 0 ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setCollecting({
                              userId: debt.userId,
                              name: debt.fullName ?? debt.email,
                              remaining: debt.remaining,
                            })
                          }
                        >
                          Thu tiền
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </CardContent>
      </Card>

      <PayDialog
        open={collecting !== null}
        onOpenChange={(open) => !open && setCollecting(null)}
        orgId={orgId}
        remaining={collecting?.remaining ?? 0}
        payerUserId={collecting?.userId}
        payerName={collecting?.name}
      />
    </div>
  )
}
