import { RequireAuth } from "@/components/wrapper/require-auth";
import { AppHeader } from "./_components/app-header";

/**
 * Input: Nội dung các route private.
 * Output: Bọc RequireAuth (chưa/hết đăng nhập → /login) và thêm header dùng chung.
 *         Khung flex-col cao đúng viewport để màn bên trong (vd bản đồ) tự chiếm
 *         hết phần còn lại mà không cần tính chiều cao thủ công.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAuth>
      <div className="flex h-screen flex-col bg-background">
        <AppHeader />
        {children}
      </div>
    </RequireAuth>
  );
}
