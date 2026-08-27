"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item"
import { formatDate } from "@/lib/format"
import { useAuthStore } from "@/providers/auth-store-provider"
import type { OrganizationMember } from "@/types/organization"

/**
 * Input: Tên/email của một thành viên.
 * Output: 1–2 ký tự viết tắt cho avatar khi không tải được ảnh. Cùng thuật toán với UserMenu —
 *         hai chỗ vẽ avatar phải rơi về cùng một chữ cái cho cùng một người.
 */
function initialsOf(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Input: Danh sách thành viên do server component fetch (owner trước).
 * Output: Mỗi người một dòng: avatar, tên, email, vai trò, ngày vào tổ chức. Dòng của chính
 *         mình có nhãn "Bạn".
 *
 *         Là client component chỉ vì một việc: biết ai là "mình". So bằng `userId` lấy từ store
 *         auth chứ không so email — email đổi được, id thì không.
 *
 *         Không có hành động nào (xoá thành viên, đổi quyền): đó là quyết định khác, chưa có
 *         endpoint, và một danh sách chỉ để đọc thì không cần cột hành động rỗng.
 */
export function MemberList({ members }: { members: OrganizationMember[] }) {
  const currentUserId = useAuthStore((state) => state.user?.userId)

  return (
    <div className="divide-y rounded-xl border">
      {members.map((member) => {
        const displayName = member.fullName?.trim() || member.email

        return (
          <Item key={member.userId} className="rounded-none">
            <ItemMedia>
              <Avatar>
                {member.avatarUrl ? (
                  <AvatarImage src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : null}
                <AvatarFallback>{initialsOf(member.fullName, member.email)}</AvatarFallback>
              </Avatar>
            </ItemMedia>

            <ItemContent>
              <ItemTitle className="gap-1.5">
                <span className="truncate">{displayName}</span>
                {member.userId === currentUserId ? (
                  <Badge variant="outline" className="shrink-0">
                    Bạn
                  </Badge>
                ) : null}
              </ItemTitle>
              <ItemDescription>{member.email}</ItemDescription>
            </ItemContent>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                {member.role === "owner" ? "Chủ tổ chức" : "Thành viên"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Vào {formatDate(member.joinedAt)}
              </span>
            </div>
          </Item>
        )
      })}
    </div>
  )
}
