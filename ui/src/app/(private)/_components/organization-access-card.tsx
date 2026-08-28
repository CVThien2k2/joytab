"use client"

import { useState } from "react"
import { Check, Copy, KeyRound, Link2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToggleJoinByCode } from "@/hooks/use-organizations-api"
import type { Organization } from "@/types/organization"

/** Thứ vừa được sao chép, để đổi nhãn đúng một nút trong 2 giây. */
type Copied = "code" | "link" | null

/**
 * Input: Tổ chức đang xem.
 * Output: Mã tham gia và liên kết mời (MỌI thành viên thấy, mỗi thứ một nút sao chép), kèm công
 *         tắc mở/đóng cửa — CHỈ owner.
 *
 *         Mời bạn vào nhóm là việc ai trong nhóm cũng làm, nên chặn member ở đây chỉ tạo một
 *         nút thắt phải đi qua owner. Nhưng quyền MỞ và XOAY mã thì vẫn của riêng owner: mở cửa
 *         chính là hành vi duyệt, và đóng cửa phải giết được mọi liên kết đã phát ra.
 *
 *         Công tắc CHÍNH LÀ hành vi duyệt thành viên, và mã CHỈ tồn tại khi cửa đang mở — đóng
 *         là BE set mã về null. Vì vậy mở cửa luôn sinh mã MỚI: mọi liên kết đã chia sẻ trước
 *         đó chết vĩnh viễn, mở lại không hồi sinh chúng. Phải nói thẳng điều đó ra chỗ này,
 *         không thì owner tưởng bật/tắt là bật/tắt cùng một mã.
 *
 *         Hai nút sao chép chứ không một: mã dùng để đọc cho nhau qua điện thoại hoặc gõ tay
 *         vào ô "tham gia bằng mã", còn liên kết để dán vào chat — hai đường khác nhau, mỗi
 *         đường một nút.
 *
 *         Liên kết dựng từ `window.location.origin` lúc bấm chứ không phải env: app chạy ở
 *         localhost, LAN hay domain thật đều ra đúng liên kết của chính nơi owner đang mở.
 *
 *         Là một THẺ độc lập chạy suốt chiều ngang: nội dung của nó là MỘT hàng (mã + hai nút
 *         sao chép), chia đôi hàng thì mã và nút phải xuống dòng mà nửa kia vẫn trống.
 */
export function OrganizationAccessCard({ organization }: { organization: Organization }) {
  const toggle = useToggleJoinByCode()
  const [copied, setCopied] = useState<Copied>(null)

  const joinCode = organization.joinCode
  const isOpen = organization.joinByCodeEnabled
  const isOwner = organization.role === "owner"

  /**
   * Input: Thứ cần chép (mã hoặc liên kết) và nội dung của nó.
   * Output: Chép vào clipboard và đổi nhãn nút trong 2 giây.
   *         clipboard API cần secure context (https hoặc localhost) — không có thì báo lỗi kèm
   *         nguyên nội dung để owner tự chép tay, chứ không im lặng.
   */
  async function copy(what: Exclude<Copied, null>, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      toast.success(what === "code" ? "Đã sao chép mã tham gia" : "Đã sao chép liên kết mời")
      setTimeout(() => setCopied(null), 2000)
    } catch {
      toast.error(`Không sao chép được. ${what === "code" ? "Mã" : "Liên kết"}: ${value}`)
    }
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Mời người vào tổ chức</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOpen
              ? "Ai có mã hoặc liên kết đều vào thẳng, không cần duyệt."
              : isOwner
                ? "Chưa có mã nào dùng được. Mở cửa để tạo mã và liên kết mời."
                : "Chủ tổ chức chưa mở cửa nên chưa có mã để mời."}
          </p>
        </div>

        {isOwner ? (
          <label className="flex shrink-0 items-center gap-2 text-sm">
            <Switch
              checked={isOpen}
              disabled={toggle.isPending}
              onCheckedChange={(checked) =>
                toggle.mutate({
                  organizationId: organization.id,
                  joinByCodeEnabled: checked,
                })
              }
              aria-label="Mở hoặc đóng cửa vào tổ chức bằng mã"
            />
            {isOpen ? "Đang mở" : "Đang đóng"}
          </label>
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">
            {isOpen ? "Đang mở" : "Đang đóng"}
          </span>
        )}
      </div>

      {joinCode ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 font-mono text-sm tracking-[0.25em] uppercase">
              <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {joinCode}
            </span>

            <Button type="button" variant="outline" onClick={() => copy("code", joinCode)}>
              {copied === "code" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied === "code" ? "Đã sao chép" : "Sao chép mã"}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => copy("link", `${window.location.origin}/join/${joinCode}`)}
            >
              {copied === "link" ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {copied === "link" ? "Đã sao chép" : "Sao chép liên kết mời"}
            </Button>
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {isOwner
              ? "Đóng cửa là mã này mất hẳn. Mở lại sẽ tạo mã mới, nên mọi liên kết đã chia sẻ trước đó không dùng được nữa — cũng là cách xoay mã khi mã cũ bị lọt ra ngoài."
              : "Chủ tổ chức đóng cửa là mã này mất hẳn, và liên kết bạn đã chia sẻ cũng thôi dùng được."}
          </p>
        </>
      ) : null}
    </section>
  )
}
