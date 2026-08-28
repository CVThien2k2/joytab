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
      {/* Không có khối tiêu đề: breadcrumb trên thanh header đã nói trang này là gì, nhắc lại
          bên trong thẻ chỉ đẩy phần nhập liệu xuống thấp. */}
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        <ProfileForm />

        <ThemeSetting />
      </div>
    </main>
  )
}
