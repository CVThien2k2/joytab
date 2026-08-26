import { Spinner } from "@/components/ui/spinner"

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái "đang kiểm tra" trong lúc page gọi /auth/me.
 *
 *         Cùng kiểu với hub (JoinOrgStep, VerifyClient): spinner + một dòng nói rõ đang chờ
 *         cái gì, chứ không phải spinner trần không biết máy đang làm gì.
 *         Nằm giữa màn hình giống trang thật nên khi dữ liệu về chỉ đổi nội dung, không giật.
 */
export default function OnboardingLoading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm">Đang kiểm tra thông tin của bạn</p>
      </div>
    </main>
  )
}
