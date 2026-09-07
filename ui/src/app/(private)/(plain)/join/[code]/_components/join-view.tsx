"use client"

import Link from "next/link"
import { Building2, Link2Off } from "lucide-react"
import { isJoinCodeUnusable } from "@/api/organizations"
import { JoinByLinkButton } from "@/app/(private)/_components/join-by-link-button"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationPreview } from "@/hooks/use-organizations-api"

/**
 * Input: Mã tham gia trên URL (/join/ABCD1234) — chính là mã owner chia sẻ.
 * Output: Màn hình riêng cho liên kết mời, đúng bốn trạng thái:
 *  - Đang kiểm tra → spinner.
 *  - Liên kết dùng được → tên tổ chức + số thành viên + nút tham gia ngay.
 *  - Đã là thành viên → không hiện nút, chỉ mời vào thẳng app.
 *  - Mã sai / tổ chức đã đóng cửa (ORG_002) → nói rõ là liên kết không dùng được, kèm lối về.
 *
 *         Không tự guard đăng nhập: proxy đã đá người chưa đăng nhập về /login kèm
 *         `?next=/join/MÃ`, và BE mang giá trị đó đi vòng qua Google rồi trả về đúng đây.
 *
 *         Mã sai tách khỏi lỗi thật: một link mời cũ là chuyện BÌNH THƯỜNG, phải có màn hình
 *         giải thích tử tế chứ không phải một khối chữ đỏ.
 */
export function JoinView({ joinCode }: { joinCode: string }) {
  const { data, isPending, error } = useOrganizationPreview(joinCode)

  if (isPending) {
    return (
      <JoinScreen tone="muted" icon={<Spinner className="size-6" />} title="Đang kiểm tra liên kết">
        {null}
      </JoinScreen>
    )
  }

  if (error) {
    if (isJoinCodeUnusable(error)) {
      return (
        <JoinScreen
          tone="muted"
          icon={<Link2Off className="size-6" aria-hidden="true" />}
          title="Liên kết mời không dùng được"
        >
          <Button asChild variant="outline">
            <Link href="/">Về trang chủ</Link>
          </Button>
        </JoinScreen>
      )
    }

    return (
      <JoinScreen
        tone="muted"
        icon={<Link2Off className="size-6" aria-hidden="true" />}
        title="Không tải được thông tin lời mời"
      >
        <Button asChild variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </JoinScreen>
    )
  }

  const { name, memberCount, alreadyMember } = data

  if (alreadyMember) {
    return (
      <JoinScreen
        tone="muted"
        icon={<Building2 className="size-6" aria-hidden="true" />}
        title={`Bạn đã ở trong "${name}"`}
      >
        <Button asChild>
          <Link href="/">Vào Joytab</Link>
        </Button>
      </JoinScreen>
    )
  }

  return (
    <JoinScreen
      icon={<Building2 className="size-6" aria-hidden="true" />}
      title={`Tham gia "${name}"`}
      meta={[`${memberCount} thành viên`]}
    >
      <JoinByLinkButton joinCode={joinCode} />
      <Button asChild variant="outline">
        <Link href="/">Để sau</Link>
      </Button>
    </JoinScreen>
  )
}

/**
 * Input: icon, tiêu đề, dòng phụ (tuỳ chọn) và các nút hành động.
 * Output: Khung chung của mọi trạng thái ở trên — gom lại một chỗ để các màn hình không trôi
 *         mỗi cái một kiểu khi sửa sau này.
 */
function JoinScreen({
  icon,
  title,
  meta,
  tone = "primary",
  children,
}: {
  icon: React.ReactNode
  title: string
  /** Các mẩu thông tin ngắn, hiện trên một dòng và tự cách nhau bằng dấu `|`. */
  meta?: string[]
  /** "primary" = lời mời dùng được; "muted" = đường cụt (hỏng / đã ở trong tổ chức rồi). */
  tone?: "primary" | "muted"
  children: React.ReactNode
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div
          className={
            tone === "muted"
              ? "mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
              : "mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          }
        >
          {icon}
        </div>

        <h1 className="mt-4 text-base font-semibold tracking-tight">{title}</h1>
        {meta?.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {meta.map((item, index) => (
              <span key={item}>
                {index > 0 ? <span className="mx-1.5 opacity-40">|</span> : null}
                {item}
              </span>
            ))}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>
      </div>
    </main>
  )
}
