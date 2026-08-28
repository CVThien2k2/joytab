import type { Metadata } from "next"
import { ProfileForm } from "./_components/profile-form"
import { ThemeSetting } from "./_components/theme-setting"

export const metadata: Metadata = {
  title: "Thông tin cá nhân",
  robots: { index: false, follow: false },
}

/**
 * Input: Không nhận props.
 * Output: Trang thông tin cá nhân — tiêu đề, ảnh đại diện, form thông tin và khu chọn giao diện,
 *         tất cả trong MỘT thẻ, các khối cách nhau bằng đường kẻ.
 *
 *         Là server component chỉ để đặt tiêu đề và metadata: dữ liệu user đã nằm trong store
 *         (layout của nhóm route đã fetch /auth/me), nên không gọi thêm request nào.
 */
export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      {/* Tiêu đề nằm TRONG thẻ, thành khối đầu tiên: trang này chỉ có đúng một thẻ, để tiêu đề
          trôi bên ngoài thì phần trên trang trống trải trong khi cái thẻ lại bắt đầu bằng một
          khối không có ngữ cảnh gì. */}
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <div className="p-4">
          <h1 className="text-base font-semibold tracking-tight">Thông tin cá nhân</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ảnh và thông tin ở đây là những gì thành viên khác trong tổ chức nhìn thấy về bạn.
          </p>
        </div>

        <ProfileForm />

        <ThemeSetting />
      </div>
    </main>
  )
}
