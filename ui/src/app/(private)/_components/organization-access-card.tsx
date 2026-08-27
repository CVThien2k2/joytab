"use client"

import { useState } from "react"
import { Check, Copy, KeyRound } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToggleJoinByCode } from "@/hooks/use-organizations-api"
import type { Organization } from "@/types/organization"

/**
 * Input: Tổ chức đang xem (chỉ render khi user là owner — member không có `joinCode`).
 * Output: Khu điều khiển cửa vào tổ chức: công tắc mở/đóng, mã tham gia để đọc cho nhau, và
 *         nút copy link mời.
 *
 *         Công tắc CHÍNH LÀ hành vi duyệt thành viên: tắt thì cả mã gõ tay lẫn link mời đều
 *         vô hiệu, nên khi tắt phải nói thẳng ra chứ không để owner tưởng link vẫn sống.
 *
 *         Link dựng từ `window.location.origin` lúc bấm chứ không phải env: app chạy ở
 *         localhost, LAN hay domain thật đều ra đúng link của chính nơi owner đang mở.
 */
export function OrganizationAccessCard({ organization }: { organization: Organization }) {
  const toggle = useToggleJoinByCode()
  const [copied, setCopied] = useState(false)

  if (!organization.joinCode) return null
  const joinCode = organization.joinCode

  /**
   * Input: Không nhận tham số.
   * Output: Chép link mời vào clipboard và đổi nhãn nút trong 2 giây.
   *         clipboard API cần secure context (https hoặc localhost) — không có thì báo lỗi
   *         kèm link để owner tự chép tay, chứ không im lặng.
   */
  async function copyInviteLink(): Promise<void> {
    const link = `${window.location.origin}/join/${joinCode}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success("Đã copy link mời")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(`Không copy được. Link mời: ${link}`)
    }
  }

  return (
    <section className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Mời người vào tổ chức</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {organization.joinByCodeEnabled
              ? "Đang mở: ai có mã hoặc link đều vào thẳng, không cần bạn duyệt."
              : "Đang đóng: mã và link mời đều không dùng được cho tới khi bạn mở."}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={organization.joinByCodeEnabled}
            disabled={toggle.isPending}
            onCheckedChange={(checked) =>
              toggle.mutate({
                organizationId: organization.id,
                joinByCodeEnabled: checked,
              })
            }
            aria-label="Mở hoặc đóng cửa vào tổ chức bằng mã"
          />
          {organization.joinByCodeEnabled ? "Đang mở" : "Đang đóng"}
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 font-mono text-sm tracking-[0.25em] uppercase">
          <KeyRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {joinCode}
        </span>

        <Button type="button" variant="outline" onClick={copyInviteLink}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Đã copy" : "Copy link mời"}
        </Button>
      </div>
    </section>
  )
}
