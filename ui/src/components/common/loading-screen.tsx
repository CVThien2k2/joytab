import { JoytabLogo } from "@/components/common/joytab-logo";

/**
 * Input: Không nhận props.
 * Output: Màn loading dùng chung — logo Joytab ở giữa, nhấp nháy (animate-pulse).
 *         Dùng cho trang /login/callback trong lúc gọi /auth/me — chỗ đó là chờ
 *         network thật. Rehydrate store thì KHÔNG dùng màn này (chỉ một tick).
 */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <JoytabLogo className="w-40 animate-pulse text-primary" />
    </div>
  );
}
