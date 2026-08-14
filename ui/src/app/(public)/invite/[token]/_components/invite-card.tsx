"use client"

import { Users } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { useAcceptInvite, useInvitePreview } from "@/hooks/use-invites"
import { redirectToGoogleLogin } from "@/lib/google-login"
import { useAuthStore } from "@/stores/auth-store"

/** Nơi lưu token khi phải đi vòng qua Google — OAuth redirect không mang state theo được. */
const PENDING_INVITE_KEY = "joytab-pending-invite"

/**
 * Input: Token lời mời trên URL.
 * Output: Xem trước tên nhóm rồi tham gia.
 *
 * Chưa đăng nhập thì nhớ token vào localStorage trước khi đẩy sang Google: sau khi quay lại
 * `/login/callback` rồi về `/`, trang này không còn trên màn hình nữa nên phải có chỗ neo lại.
 */
export function InviteCard({ token }: { token: string }) {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const hydrated = useAuthStore((state) => state.hydrated)
  const { data: preview, isPending, isError } = useInvitePreview(token)
  const acceptInvite = useAcceptInvite()
  // Cờ "đã tự động tham gia" dùng ref chứ không phải state: nó không ảnh hưởng gì tới cái
  // đang hiển thị, và setState trong effect chỉ đẻ thêm một vòng render vô ích.
  const autoAcceptedRef = useRef(false)

  /**
   * Input: Không nhận tham số.
   * Output: Tham gia nhóm rồi vào thẳng nhóm đó.
   */
  function join() {
    acceptInvite.mutate(token, {
      onSuccess: (result) => {
        localStorage.removeItem(PENDING_INVITE_KEY)
        toast.success(
          result.alreadyMember ? "Bạn đã ở trong nhóm này" : "Đã tham gia nhóm",
        )
        router.replace(`/orgs/${result.organizationId}`)
      },
    })
  }

  // Vừa đăng nhập xong và quay lại đúng link mời này thì tham gia luôn, không bắt bấm lần nữa.
  useEffect(() => {
    if (!hydrated || !user || autoAcceptedRef.current) return
    if (localStorage.getItem(PENDING_INVITE_KEY) !== token) return
    autoAcceptedRef.current = true
    join()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, token])

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <JoytabLogo iconOnly className="mx-auto h-12 w-12" />
          {isPending ? (
            <Skeleton className="mx-auto mt-4 h-6 w-40" />
          ) : isError ? (
            <>
              <CardTitle>Lời mời không tồn tại</CardTitle>
              <CardDescription>
                Link có thể đã bị gõ sai hoặc đã bị xoá.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>Lời mời tham gia</CardTitle>
              <CardDescription className="flex items-center justify-center gap-1">
                <Users className="size-3.5" />
                {preview.organization.name} · {preview.organization.memberCount} thành viên
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {preview && !preview.usable ? (
            <p className="text-muted-foreground text-center text-sm">
              Lời mời này đã hết hạn, bị thu hồi hoặc hết lượt dùng. Nhờ quản trị viên
              gửi lại link mới.
            </p>
          ) : preview ? (
            user ? (
              <Button
                className="w-full"
                disabled={acceptInvite.isPending}
                onClick={join}
              >
                {acceptInvite.isPending ? "Đang tham gia…" : "Tham gia nhóm"}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={() => {
                  localStorage.setItem(PENDING_INVITE_KEY, token)
                  redirectToGoogleLogin()
                }}
              >
                Đăng nhập với Google để tham gia
              </Button>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
