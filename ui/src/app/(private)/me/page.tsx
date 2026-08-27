import type { Metadata } from "next"
import { ProfileForm } from "./_components/profile-form"

export const metadata: Metadata = {
  title: "Thông tin cá nhân",
  robots: { index: false, follow: false },
}

/**
 * Input: Không nhận props.
 * Output: Trang thông tin cá nhân — ảnh đại diện + form thông tin, gộp trong một thẻ.
 *
 *         Là server component chỉ để đặt tiêu đề và metadata: dữ liệu user đã nằm trong store
 *         (layout của nhóm route đã fetch /auth/me), nên không gọi thêm request nào.
 */
export default function ProfilePage() {
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <h1 className="text-lg font-semibold tracking-tight">Thông tin cá nhân</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Ảnh và thông tin ở đây là những gì thành viên khác trong tổ chức nhìn thấy về bạn.
      </p>

      <div className="mt-6">
        <ProfileForm />
      </div>
    </main>
  )
}
