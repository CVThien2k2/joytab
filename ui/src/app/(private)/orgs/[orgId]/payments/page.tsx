"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ChargeGroupCard } from "@/components/common/charge-group-card"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationCharges, usePayments } from "@/hooks/use-payments-api"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { PaymentList } from "./_components/payment-list"

/** Hai cách nhìn cùng một luồng tiền: còn phải trả, và đã trả rồi. */
type Tab = "mine" | "history"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store.
 * Output: Trang thanh toán của một tổ chức.
 *
 *         Không còn hàng đợi duyệt: người trả tự ghi nhận đã chuyển tiền, nên chủ tổ chức
 *         không có việc gì phải làm ở đây — chỉ khác member ở chỗ sổ chứng từ hiện của cả tổ
 *         chức chứ không riêng mình.
 *
 *         Vì vậy tab mở sẵn giống nhau cho mọi người: "Khoản của tôi", tức việc của chính mình.
 */
export default function OrganizationPaymentsPage() {
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const [tab, setTab] = useState<Tab>("mine")

  const { data: groups, isPending: chargesPending } = useOrganizationCharges(organization.id)
  const { data: history, isPending: historyPending } = usePayments(organization.id)

  const tabs: { key: Tab; label: string }[] = [
    { key: "mine", label: "Khoản của tôi" },
    { key: "history", label: isOwner ? "Đã trả (cả tổ chức)" : "Tôi đã trả" },
  ]

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      {/* Không lặp lại tên trang ở đây: breadcrumb trên thanh header đã nói, mà nói hai lần
          thì lần thứ hai chỉ tốn chiều cao. */}
      <div className="flex flex-wrap gap-2">
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
              Bạn không còn khoản nào phải trả ở tổ chức này.
            </div>
          )
        ) : (
          <PaymentList
            payments={history ?? []}
            loading={historyPending}
            emptyText={isOwner ? "Chưa ai thanh toán lần nào." : "Bạn chưa thanh toán lần nào."}
          />
        )}
      </div>
    </main>
  )
}
