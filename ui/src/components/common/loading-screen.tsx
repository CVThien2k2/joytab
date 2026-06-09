import { JoytabLogo } from "@/components/common/joytab-logo"

/**
 * Input: Không nhận props.
 * Output: Màn loading dùng chung — logo Joytab ở giữa, nhấp nháy (animate-pulse).
 *         Dùng khi đang validate phiên từ server (chưa checked).
 */
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <JoytabLogo className="w-40 animate-pulse text-primary" />
    </div>
  )
}
