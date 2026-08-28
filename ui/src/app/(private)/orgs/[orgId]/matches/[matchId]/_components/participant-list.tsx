"use client"

import { AccountAvatar } from "@/components/common/account-avatar"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import type { MatchParticipant } from "@/types/match"

/** Nhãn giới tính — chỉ để người xem hiểu vì sao hai người cùng trận đóng khác nhau. */
const GENDER_LABEL: Record<string, string> = { male: "Nam", female: "Nữ", other: "Khác" }

export function ParticipantList({
  participants,
  currentUserId,
}: {
  participants: MatchParticipant[]
  currentUserId: string
}) {
  if (participants.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Chưa ai đăng ký. Bạn có thể là người đầu tiên.
      </div>
    )
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {participants.map((participant) => {
        const name = participant.fullName ?? "Thành viên"
        return (
          <li key={participant.userId} className="flex items-center gap-3 p-3">
            <AccountAvatar name={name} src={participant.avatarUrl} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {name}
                {participant.userId === currentUserId ? (
                  <span className="ml-1 text-xs text-muted-foreground">(Bạn)</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                Đăng ký {formatDateTime(participant.votedAt)}
              </p>
            </div>
            {participant.gender ? (
              <Badge variant="outline">{GENDER_LABEL[participant.gender]}</Badge>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
