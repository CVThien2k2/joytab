"use client"

import { useState } from "react"
import {
  Check,
  KeyRound,
  Landmark,
  Link2,
  LogOut,
  Pencil,
  Scale,
  Trash2,
  Users,
} from "lucide-react"
import { toast } from "sonner"
import { LeaveOrganizationDialog } from "@/app/(private)/_components/leave-organization-dialog"
import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { useOrganizationMembers, useToggleJoinByCode } from "@/hooks/use-organizations-api"
import { buildInviteLink, copyText } from "@/lib/clipboard"
import { formatDate } from "@/lib/format"
import type { Organization, OrganizationMember } from "@/types/organization"
import { DeleteOrganizationDialog } from "./delete-organization-dialog"
import { EditOrganizationDialog } from "./edit-organization-dialog"
import { MembersList } from "./members-list"

/** Số avatar hiện ngoài thẻ. Hơn nữa thì hàng avatar dài bằng cả một bảng mà vẫn không đọc được tên. */
const PREVIEW_LIMIT = 6

/** Cỡ avatar ngoài thẻ (px). Đủ nhận ra mặt người mà vẫn xếp vừa một hàng trên điện thoại. */
const PREVIEW_AVATAR_SIZE = 32

/**
 * Input: Tổ chức đang xem.
 * Output: MỘT thẻ duy nhất ở đầu trang chủ, gói cả hồ sơ tổ chức vào hai tầng: tên + vai trò +
 *         avatar thành viên ở tầng trên, rồi tài khoản nhận tiền + hệ số + mã mời + công tắc
 *         cửa vào ở tầng thông tin, và cuối cùng là một hàng nút.
 *
 *         Trước đây là BỐN thẻ xếp dọc (thông tin, mã mời, thành viên, khu vực nguy hiểm), mỗi
 *         thẻ một tiêu đề và một đoạn mô tả. Cộng lại chúng đẩy phần lịch và tiền — thứ người ta
 *         mở app hàng ngày để xem — xuống dưới hai màn cuộn, trong khi nội dung thật của cả bốn
 *         chỉ là vài chuỗi ngắn. Gộp lại thì đọc hết hồ sơ tổ chức trong một cái liếc.
 *
 *         Mã mời và công tắc cửa vào nằm CÙNG hàng với tài khoản và hệ số, không còn là một khối
 *         riêng có đường kẻ: cả bốn thứ đều là thông tin để TRA, mà tách chúng ra chỉ thêm một
 *         đường kẻ và một khoảng trắng để nói cùng một loại nội dung.
 *
 *         Thao tác bày THẲNG thành nút ở hàng cuối, không nấp trong menu "...": với một tổ
 *         chức chỉ có đúng vài việc làm được, mà vài mục thì không đủ nhiều để đáng giấu sau một
 *         cú bấm — giấu đi chỉ khiến người ta phải mở ra mới biết mình làm được gì.
 *
 *         Xoá tổ chức là một nút ở đây chứ không còn là khối đỏ riêng cuối trang. Bước gõ lại
 *         đúng tên để xác nhận vẫn nguyên (xem DeleteOrganizationDialog) — đó mới là hàng rào
 *         thật, còn cái khối đỏ chỉ là lời cảnh báo.
 */
export function OrganizationSummaryCard({ organization }: { organization: Organization }) {
  const [membersOpen, setMembersOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const isOwner = organization.role === "owner"
  const isOpen = organization.joinByCodeEnabled
  const joinCode = organization.joinCode
  const toggle = useToggleJoinByCode()

  const { data, isPending } = useOrganizationMembers({
    organizationId: organization.id,
    page: 1,
    pageSize: PREVIEW_LIMIT,
  })
  const members = data?.members ?? []
  const overflow = organization.memberCount - members.length

  /**
   * Input: Mã mời đang mở.
   * Output: Chép LIÊN KẾT mời vào clipboard rồi đổi icon nút đó trong 2 giây.
   *
   *         Chỉ còn một nút chép, và nó chép liên kết: người nhận bấm vào là vào thẳng màn hình
   *         tham gia, còn cái mã thì vẫn hiện ngay bên cạnh cho ai muốn đọc cho nhau qua điện
   *         thoại — hai nút chép trông gần giống nhau chỉ tạo ra cơ hội chép nhầm.
   *
   *         Hỏng thì đọc nguyên liên kết ra toast để người dùng tự chép tay: clipboard API chỉ
   *         có trong secure context, mà mở app qua http trên máy khác trong mạng LAN là chuyện
   *         thường — im lặng ở đó nghĩa là họ dán ra một thứ còn sót từ lần trước.
   */
  async function copyInviteLink(code: string): Promise<void> {
    const link = buildInviteLink(code)

    if (await copyText(link)) {
      setCopied(true)
      toast.success("Đã sao chép liên kết mời")
      setTimeout(() => setCopied(false), 2000)
      return
    }
    toast.error(`Không sao chép được. Liên kết: ${link}`)
  }

  return (
    <>
      <section className="rounded-xl border bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">
            {organization.name}
          </h2>
          <Badge variant={isOwner ? "default" : "secondary"} className="shrink-0">
            {isOwner ? "Chủ tổ chức" : "Thành viên"}
          </Badge>

          {/* `ms-auto` đẩy hàng avatar sang mép phải; màn hẹp thì `flex-wrap` cho nó xuống dòng
              nguyên khối thay vì ép tên tổ chức co lại còn vài chữ. Bấm vào là mở danh sách —
              nút "Thành viên" ở dưới là đường chính, đây chỉ là lối tắt cho chuột. */}
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label={`Xem ${organization.memberCount} thành viên`}
            className="ms-auto flex shrink-0 items-center -space-x-2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {isPending
              ? Array.from({
                  length: Math.min(PREVIEW_LIMIT, organization.memberCount),
                }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="rounded-full ring-2 ring-card"
                    style={{ width: PREVIEW_AVATAR_SIZE, height: PREVIEW_AVATAR_SIZE }}
                  />
                ))
              : members.map((member) => <MemberAvatar key={member.userId} member={member} />)}

            {overflow > 0 ? (
              <span
                className="grid shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-card"
                style={{ width: PREVIEW_AVATAR_SIZE, height: PREVIEW_AVATAR_SIZE }}
              >
                +{overflow}
              </span>
            ) : null}
          </button>
        </div>

        {/* TẦNG THÔNG TIN: mọi mẩu tra cứu của tổ chức trong MỘT hàng `flex-wrap` — trên desktop
            nó là một dòng, trên điện thoại nó tự gãy, không cần media query nào.

            KHÔNG mẩu nào có tiêu đề riêng: icon đứng trước đã nói nó là gì, còn một công tắc ghi
            "Đang mở" đứng cạnh một cái mã thì tự nói hết nghĩa của nó. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Landmark className="size-3.5 shrink-0" aria-hidden="true" />
            {organization.bankAccount ? (
              <span className="tabular-nums">
                {organization.bankAccount.bankShortName} · {organization.bankAccount.accountNo}
              </span>
            ) : (
              "Chưa có tài khoản nhận tiền"
            )}
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Scale className="size-3.5 shrink-0" aria-hidden="true" />
            Nam ×{organization.maleRatio} · nữ ×1
          </span>

          {isOwner ? (
            <label className="inline-flex shrink-0 items-center gap-2">
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
          ) : null}

          {joinCode ? (
            // Mã giãn chữ và dùng font đều nét: nó được đọc cho nhau qua điện thoại và chép
            // tay, nên nhầm 0 với O là lỗi thật.
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 font-mono text-xs tracking-[0.18em] text-foreground uppercase">
              <KeyRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {joinCode}
            </span>
          ) : (
            // Owner đã có công tắc ghi "Đang đóng" ngay bên trái nên không cần nói lại; chỉ
            // member mới cần biết vì sao không thấy mã nào.
            !isOwner && <span>Chủ tổ chức đang đóng cửa, chưa có mã mời.</span>
          )}
        </div>

        {/* HÀNG NÚT, tách bằng một đường kẻ: đây là thao tác, còn mọi thứ trên là thông tin. Các
            nút bày thẳng ra thay vì nấp trong menu "..." — chúng là toàn bộ việc làm được với
            một tổ chức, mà vài mục thì không đủ nhiều để đáng giấu sau một cú bấm. */}
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {joinCode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copyInviteLink(joinCode)}
            >
              {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {copied ? "Đã chép" : "Chép liên kết"}
            </Button>
          ) : null}

          <Button type="button" variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
            <Users aria-hidden="true" />
            Thành viên
          </Button>

          {isOwner ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Sửa
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setDeleting(true)}
              >
                <Trash2 aria-hidden="true" />
                Xoá tổ chức
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setLeaving(true)}
            >
              <LogOut aria-hidden="true" />
              Rời tổ chức
            </Button>
          )}
        </div>
      </section>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        {/* Rộng như hộp thoại thường: ruột chỉ còn là một danh sách dọc, mỗi dòng hai tầng chữ —
            kéo rộng ra chỉ tạo một dải trắng giữa tên và ngày tham gia. */}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thành viên · {organization.name}</DialogTitle>
            <DialogDescription>
              {organization.memberCount} người trong tổ chức, chủ tổ chức xếp trước.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="max-h-[65vh]">
            <MembersList organizationId={organization.id} isOwner={isOwner} />
          </DialogBody>
        </DialogContent>
      </Dialog>

      {isOwner ? (
        <>
          <EditOrganizationDialog
            organization={organization}
            open={editing}
            onClose={() => setEditing(false)}
          />
          <DeleteOrganizationDialog
            organization={organization}
            open={deleting}
            onOpenChange={setDeleting}
          />
        </>
      ) : (
        <LeaveOrganizationDialog
          organization={organization}
          open={leaving}
          onOpenChange={setLeaving}
        />
      )}
    </>
  )
}

/**
 * Input: Một thành viên.
 * Output: Avatar, rê chuột thì hiện tên + email + vai trò + ngày vào.
 *
 *         Dùng HoverCard chứ không Tooltip: cần mấy dòng chữ có thứ bậc, mà tooltip chỉ hợp với
 *         một nhãn ngắn. Trên cảm ứng không có hover — nên nút "Thành viên" vẫn là đường chính
 *         để đọc danh sách, hover chỉ là lối tắt cho chuột.
 *
 *         Là `<span>` chứ không `<button>`: cả hàng avatar đã nằm trong một nút mở danh sách,
 *         mà nút lồng trong nút là HTML không hợp lệ.
 */
function MemberAvatar({ member }: { member: OrganizationMember }) {
  const name = member.fullName ?? member.email

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <span className="rounded-full ring-2 ring-card transition-transform hover:z-10 hover:scale-110">
          <AccountAvatar name={name} src={member.avatarUrl} size={PREVIEW_AVATAR_SIZE} />
        </span>
      </HoverCardTrigger>

      <HoverCardContent className="w-auto max-w-64 p-3">
        <div className="flex items-center gap-2.5">
          <AccountAvatar name={name} src={member.avatarUrl} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <Badge variant={member.role === "owner" ? "default" : "secondary"}>
            {member.role === "owner" ? "Chủ tổ chức" : "Thành viên"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Vào ngày {formatDate(member.joinedAt)}
          </span>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
