"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Inbox, MoreHorizontal, Trash2 } from "lucide-react"
import { getApiErrorMessage } from "@/api/error"
import { AccountAvatar } from "@/components/common/account-avatar"
import { SearchInput } from "@/components/common/search-input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import { useDebounce } from "@/hooks/use-debounce"
import { useInfiniteOrganizationMembers } from "@/hooks/use-organizations-api"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/stores/auth-store"
import type { OrganizationMember, OrganizationRole } from "@/types/organization"
import { RemoveMemberDialog } from "./remove-member-dialog"

/**
 * Badge vai trò theo lối hub (nền tint mềm, viền trong suốt) nhưng map CỐ ĐỊNH thay vì chọn
 * theo hash: hub có role tuỳ chỉnh không biết trước nên phải hash, còn ở đây chỉ có đúng hai
 * vai trò — gán màu cố định thì owner luôn là màu đó, không đổi khi thêm role thứ ba.
 */
const ROLE_BADGE: Record<OrganizationRole, { label: string; className: string }> = {
  owner: {
    label: "Chủ tổ chức",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  member: {
    label: "Thành viên",
    className: "bg-muted text-muted-foreground",
  },
}

/** Cỡ avatar (px) của một dòng. */
const AVATAR_SIZE = 36

/** Chờ gõ xong rồi mới hỏi server — bằng nhịp của mọi ô tìm kiếm khác trong app. */
const SEARCH_DEBOUNCE_MS = 300

/** Một dòng thành viên: avatar + tên + email bên trái, vai trò + ngày vào bên phải. */
function MemberRow({
  member,
  isSelf,
  canRemove,
  onRemove,
}: {
  member: OrganizationMember
  isSelf: boolean
  canRemove: boolean
  onRemove: () => void
}) {
  const displayName = member.fullName?.trim() || member.email
  const role = ROLE_BADGE[member.role]

  return (
    <li className="flex items-center gap-3 py-2.5">
      <AccountAvatar name={displayName} src={member.avatarUrl} size={AVATAR_SIZE} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {isSelf ? (
            <Badge variant="outline" className="shrink-0">
              Bạn
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-xs text-muted-foreground">{member.email}</div>
      </div>

      {/* Vai trò và ngày vào xếp DỌC ở mép phải chứ không thành hai cột: ở bề ngang điện thoại,
          hai mẩu này nằm ngang sẽ ép phần tên còn vài chữ. */}
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Badge variant="outline" className={cn("border-transparent", role.className)}>
          {role.label}
        </Badge>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {formatDate(member.joinedAt)}
        </span>
      </div>

      {canRemove ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label={`Hành động với ${displayName}`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 aria-hidden="true" />
              Xoá khỏi tổ chức
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </li>
  )
}

/**
 * Input: trạng thái của truy vấn khi danh sách rỗng.
 * Output: thông báo lỗi, hoặc trạng thái "chưa có ai".
 */
function EmptyState({ error, query }: { error: unknown; query: string }) {
  if (error) {
    return (
      <p className="py-10 text-center text-sm text-destructive">
        {getApiErrorMessage(error, "Không tải được danh sách thành viên.")}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Inbox className="size-6" aria-hidden="true" />
      </div>
      <div className="text-sm font-medium text-muted-foreground">
        {query ? `Không có ai khớp "${query}"` : "Chưa có thành viên nào"}
      </div>
    </div>
  )
}

/**
 * Input: id tổ chức + người xem có phải owner không.
 * Output: Danh sách thành viên trong hộp thoại: ô tìm kiếm dính ở đỉnh, rồi một list phẳng,
 *         cuộn tới đáy thì tải lô sau. Dòng của chính mình có nhãn "Bạn".
 *
 *         LIST chứ không bảng, và MỘT markup cho cả điện thoại lẫn desktop. Bảng cũ phải dựng
 *         hai nhánh (từ `sm` là `<table>` bốn cột, dưới `sm` là card) chỉ để nói đúng bốn mẩu
 *         thông tin ngắn về một người — mà bốn mẩu đó thì một dòng hai tầng đã chứa đủ. Bớt một
 *         nhánh là bớt một chỗ để hai bản lệch nhau khi sửa.
 *
 *         CUỘN LƯỜI theo lô 20 thay cho chân phân trang: đây là nội dung nằm trong hộp thoại,
 *         mà một hàng nút trang + ô chọn số dòng thì chiếm gần bằng hai dòng thành viên. Tìm ai
 *         đó thì gõ vào ô tìm kiếm nhanh hơn là nhảy trang.
 *
 *         Tìm kiếm vẫn SERVER-SIDE và nằm trong queryKey, nên đổi từ khoá là tự bắt đầu lại từ
 *         lô đầu; dữ liệu của từ khoá cũ được giữ trên màn hình trong lúc chờ (keepPreviousData)
 *         để danh sách không rỗng đi một nhịp sau mỗi ký tự.
 *
 *         Hành động xoá KHÔNG hiện trên: dòng của chính mình (muốn đi thì dùng nút "Rời tổ
 *         chức" ở thẻ tổ chức) và dòng chủ tổ chức (BE cũng chặn — ORG_005). Người xem không
 *         phải owner thì không dòng nào có nút.
 */
export function MembersList({
  organizationId,
  isOwner,
}: {
  organizationId: string
  isOwner: boolean
}) {
  const currentUserId = useAuthStore((state) => state.user?.userId)
  const [search, setSearch] = useState("")
  const query = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS)
  const [toRemove, setToRemove] = useState<OrganizationMember | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const { data, error, isPending, isFetching, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useInfiniteOrganizationMembers(organizationId, query)

  const members = useMemo(() => data?.pages.flatMap((page) => page.members) ?? [], [data])
  const pageCount = data?.pages.length ?? 0

  /**
   * Thấy đáy danh sách là tải lô sau. Cùng công thức với các danh sách cuộn khác của app
   * (xem upcoming-matches.tsx): `rootMargin` 200px để lô mới về trước khi cuộn tới hẳn đáy, và
   * `pageCount` trong deps để observer được dựng lại sau mỗi lô — lô ngắn hơn khung nhìn thì
   * cái mốc vẫn đứng yên trong khung, mà đứng yên thì không sinh thêm sự kiện intersect nào.
   *
   * Root là khung cuộn của hộp thoại, nhưng vẫn để mặc định: observer đã tính cả phần bị cha
   * `overflow` cắt đi, nên mốc chỉ "thấy được" khi nó thật sự lộ ra trong khung đó.
   */
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage()
      },
      { rootMargin: "200px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, pageCount])

  return (
    <>
      {/* Ô tìm kiếm DÍNH ở đỉnh khung cuộn: danh sách dài thì gõ lại một từ khoá khác không phải
          cuộn ngược lên đầu. `-mx-4 px-4` để dải nền phủ hết bề ngang, không hở hai mép. */}
      <div className="sticky top-0 z-10 -mx-4 bg-background px-4 pb-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Tìm theo tên hoặc email"
          className="max-w-none"
        />
      </div>

      <div className="relative">
        {members.length ? (
          <ul className="divide-y">
            {members.map((member) => {
              const isSelf = member.userId === currentUserId

              return (
                <MemberRow
                  key={member.userId}
                  member={member}
                  isSelf={isSelf}
                  canRemove={isOwner && !isSelf && member.role !== "owner"}
                  onRemove={() => setToRemove(member)}
                />
              )
            })}
          </ul>
        ) : isPending ? (
          // Lần tải đầu để trống hẳn: spinner ở dưới đã nói là đang chờ.
          <div className="h-40" />
        ) : (
          <EmptyState error={error} query={query} />
        )}

        {/* Mốc tải thêm. Có chiều cao thật và một spinner: cuộn tới đáy mà chỉ thấy khoảng
            trắng câm thì người ta tưởng hết danh sách rồi. */}
        {hasNextPage ? (
          <div ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage ? <Spinner className="size-4 text-muted-foreground" /> : null}
          </div>
        ) : null}

        {/* Chỉ che khi đang đổi từ khoá / tải lần đầu — tải lô sau thì spinner ở mốc đáy đã nói,
            phủ cả danh sách lúc đó là làm mờ thứ người ta đang đọc dở. */}
        {isFetching && !isFetchingNextPage ? (
          <div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-[1px]">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : null}
      </div>

      <RemoveMemberDialog
        organizationId={organizationId}
        member={toRemove}
        onClose={() => setToRemove(null)}
      />
    </>
  )
}
