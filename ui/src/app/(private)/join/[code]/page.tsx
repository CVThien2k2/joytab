import type { Metadata } from "next"
import Link from "next/link"
import { Building2, LinkIcon } from "lucide-react"
import { fetchOrganizationPreview } from "@/api/organizations.server"
import { Button } from "@/components/ui/button"
import { JoinByLinkButton } from "@/app/(private)/_components/join-by-link-button"

// Trang chỉ có ý nghĩa với người cầm link; không cho công cụ tìm kiếm lập chỉ mục để mã tham
// gia không rơi vào kết quả tìm kiếm.
export const metadata: Metadata = {
  title: "Lời mời tham gia",
  robots: { index: false, follow: false },
}

/**
 * Input: Mã tham gia nằm trên URL (/join/ABCD1234) — chính là mã owner chia sẻ.
 * Output: Màn hình riêng cho link mời, đúng ba trạng thái:
 *  - Link dùng được → tên tổ chức + số thành viên + nút tham gia ngay.
 *  - Đã là thành viên → không hiện nút, chỉ mời vào thẳng app.
 *  - Mã sai / tổ chức đã đóng cửa → nói rõ là link không dùng được, kèm lối về.
 *
 *         Không tự guard đăng nhập: proxy đã đá người chưa đăng nhập về /login kèm
 *         `?next=/join/MÃ`, và BE mang giá trị đó đi vòng qua Google rồi trả về đúng đây.
 *
 *         Fetch nằm ở page (không phải layout) để `loading.tsx` bọc được nếu thêm sau.
 */
export default async function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const result = await fetchOrganizationPreview(code)

  if (result.unusable) {
    return (
      <JoinScreen
        icon={<LinkIcon className="size-6" aria-hidden="true" />}
        title="Link mời không dùng được"
        description="Link đã bị đóng, mã đã được đổi, hoặc bạn dán thiếu ký tự. Hỏi lại người
          chia sẻ để lấy link mới."
      >
        <Button asChild variant="outline">
          <Link href="/">Về trang chủ</Link>
        </Button>
      </JoinScreen>
    )
  }

  if (!result.preview) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  const { name, memberCount, alreadyMember } = result.preview

  if (alreadyMember) {
    return (
      <JoinScreen
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
      <JoinByLinkButton joinCode={code} />
      <Button asChild variant="outline">
        <Link href="/">Để sau</Link>
      </Button>
    </JoinScreen>
  )
}

/**
 * Input: icon, tiêu đề, mô tả, dòng phụ (tuỳ chọn) và các nút hành động.
 * Output: Khung chung của ba trạng thái ở trên — gom lại một chỗ để ba màn hình không trôi
 *         mỗi cái một kiểu khi sửa sau này.
 */
function JoinScreen({
  icon,
  title,
  description,
  meta,
  children,
}: {
  icon: React.ReactNode
  title: string
  /** Chỉ đặt khi có thứ user cần biết để làm tiếp — trạng thái tự nói được thì bỏ trống. */
  description?: string
  /** Các mẩu thông tin ngắn, hiện trên một dòng và tự cách nhau bằng dấu `|`. */
  meta?: string[]
  children: React.ReactNode
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>

        <h1 className="mt-4 text-base font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        ) : null}
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
