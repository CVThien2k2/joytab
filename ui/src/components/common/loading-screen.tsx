import { JoytabLogo } from "@/components/common/joytab-logo";

/**
 * Input: Không nhận props.
 * Output: Màn loading dùng chung — logo Joytab ở giữa, nhấp nháy (animate-pulse).
 *         Dùng khi store chưa rehydrate xong, hoặc trang /auth/callback đang lấy user.
 */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <JoytabLogo className="w-40 animate-pulse text-primary" />
    </div>
  );
}
