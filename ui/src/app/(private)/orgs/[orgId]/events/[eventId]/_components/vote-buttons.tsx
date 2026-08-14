"use client"

import { Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVote } from "@/hooks/use-events"
import { useAuthStore } from "@/stores/auth-store"
import type { EventDetail } from "@/types/event"

/**
 * Input: Chi tiết buổi đánh.
 * Output: Hai nút bình chọn của chính mình, có optimistic update.
 *
 * Nút "Tôi đi" bị khoá khi trận đã đủ người VÀ mình chưa nằm trong danh sách — người đang
 * GOING vẫn bấm lại được (không tự chiếm mất slot của chính mình). Khoá theo thời gian thì
 * ẩn cả hai nút vì lúc đó không đổi được gì nữa.
 */
export function VoteButtons({ event }: { event: EventDetail }) {
  const myUserId = useAuthStore((state) => state.user?.userId) ?? ""
  const vote = useVote(event.id, myUserId)
  const myStatus = event.myAttendance?.status ?? null
  const isGoing = myStatus === "GOING"

  if (event.isLocked) {
    return (
      <p className="text-muted-foreground text-sm">
        {event.status === "OPEN"
          ? "Đã khoá bình chọn cho buổi này."
          : "Buổi đánh không còn mở để bình chọn."}
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={isGoing ? "default" : "outline"}
        disabled={vote.isPending || (event.isFull && !isGoing)}
        onClick={() => vote.mutate("GOING")}
      >
        <Check className="size-4" />
        Tôi đi
      </Button>
      <Button
        variant={myStatus === "NOT_GOING" ? "default" : "outline"}
        disabled={vote.isPending}
        onClick={() => vote.mutate("NOT_GOING")}
      >
        <X className="size-4" />
        Tôi bận
      </Button>
      {event.isFull && !isGoing ? (
        <p className="text-muted-foreground self-center text-sm">
          Đã đủ người — có ai bỏ chỗ thì bạn vào được ngay.
        </p>
      ) : null}
    </div>
  )
}
