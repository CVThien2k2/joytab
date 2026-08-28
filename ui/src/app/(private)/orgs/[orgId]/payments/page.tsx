"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChargeGroupCard } from "@/components/common/charge-group-card"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationCharges, usePayments } from "@/hooks/use-payments-api"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { PaymentList } from "./_components/payment-list"

/** Ba cách nhìn cùng một luồng tiền. Member chỉ thấy hai cái đầu. */
type Tab = "mine" | "history" | "queue"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store.
 * Output: Trang thanh toán của một tổ chức.
 *
 *         Member: khoản của mình + lịch sử các lần đã gửi.
 *         Owner: thêm hàng đợi đối soát, và đó là tab MỞ SẴN — với chủ tổ chức, việc cần làm
 *         khi vào đây là duyệt chứng từ, không phải xem mình nợ gì.
 */
export default function OrganizationPaymentsPage() {
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const [tab, setTab] = useState<Tab>(isOwner ? "queue" : "mine")

  const { data: groups, isPending: chargesPending } = useOrganizationCharges(organization.id)
  const { data: queue, isPending: queuePending } = usePayments(organization.id, "submitted")
  const { data: history, isPending: historyPending } = usePayments(organization.id)

  const tabs: { key: Tab; label: string }[] = [
    ...(isOwner ? [{ key: "queue" as const, label: `Chờ duyệt${queue ? ` (${queue.length})` : ""}` }] : []),
    { key: "mine", label: "Khoản của tôi" },
    { key: "history", label: isOwner ? "Tất cả chứng từ" : "Lịch sử của tôi" },
  ]

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <h1 className="text-base font-semibold tracking-tight">Thanh toán</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isOwner
          ? "Đối soát chứng từ chuyển khoản của thành viên, và xem khoản của chính bạn."
          : "Các khoản bạn cần trả trong tổ chức này và lịch sử đã gửi."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.key}
            type="button"
            variant={tab === item.key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "queue" ? (
          <PaymentList
            payments={queue ?? []}
            organizationId={organization.id}
            isOwner={isOwner}
            loading={queuePending}
            emptyText="Không có chứng từ nào đang chờ đối soát."
          />
        ) : null}

        {tab === "mine" ? (
          chargesPending ? (
            <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
              <Spinner className="size-5 text-muted-foreground" />
            </div>
          ) : groups && groups.length > 0 ? (
            <div className="space-y-4">
              {groups.map((group) => (
                <ChargeGroupCard key={group.organizationId} group={group} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Bạn không có khoản nào phải thanh toán ở tổ chức này.
            </div>
          )
        ) : null}

        {tab === "history" ? (
          <PaymentList
            payments={history ?? []}
            organizationId={organization.id}
            isOwner={isOwner}
            loading={historyPending}
            emptyText="Chưa có lần thanh toán nào."
          />
        ) : null}
      </div>
    </main>
  )
}
