"use client"

import { useState } from "react"
import { Inbox, MoreHorizontal, Trash2 } from "lucide-react"
import { getApiErrorMessage } from "@/api/error"
import { AccountAvatar } from "@/components/common/account-avatar"
import { SearchInput } from "@/components/common/search-input"
import { TablePagination } from "@/components/common/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useOrganizationMembers } from "@/hooks/use-organizations-api"
import { useTableSearch } from "@/hooks/use-table-search"
import { formatDate } from "@/lib/format"
import { useAuthStore } from "@/stores/auth-store"
import { cn } from "@/lib/utils"
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

/** Class dùng chung cho mọi ô header — khai một chỗ để các cột không trôi mỗi cột một kiểu. */
const HEAD_CLASS =
  "bg-muted/50 px-3.5 py-[11px] text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase"

/** Class dùng chung cho mọi ô nội dung. */
const CELL_CLASS = "px-3.5 py-[13px] text-[13px]"

/** Cỡ avatar (px) và khoảng cách tới phần chữ — dòng thứ hai của card thụt vào đúng bằng tổng. */
const AVATAR_SIZE = 32

/**
 * Input: một thành viên + id người đang xem + người xem có phải chủ tổ chức không.
 * Output: những thứ suy ra được để vẽ một dòng.
 *
 *         Tách ra vì bảng (từ `sm`) và danh sách card (dưới `sm`) cùng cần: quy tắc "ai được
 *         xoá" chỉ nằm ở một chỗ, sửa một lần là cả hai nhánh cùng đổi.
 */
function getRowView(
  member: OrganizationMember,
  currentUserId: string | undefined,
  isOwner: boolean,
) {
  const isSelf = member.userId === currentUserId

  return {
    displayName: member.fullName?.trim() || member.email,
    role: ROLE_BADGE[member.role],
    isSelf,
    canRemove: isOwner && !isSelf && member.role !== "owner",
  }
}

/** Avatar + tên (kèm nhãn "Bạn") + email. Dùng chung cho ô đầu của bảng và đầu card. */
function MemberIdentity({
  displayName,
  email,
  avatarUrl,
  isSelf,
}: {
  displayName: string
  email: string
  avatarUrl?: string | null
  isSelf: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <AccountAvatar name={displayName} src={avatarUrl} size={AVATAR_SIZE} />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{displayName}</span>
          {isSelf ? (
            <Badge variant="outline" className="shrink-0">
              Bạn
            </Badge>
          ) : null}
        </div>
        <div className="truncate text-[11.5px] text-muted-foreground">{email}</div>
      </div>
    </div>
  )
}

/** Badge vai trò. */
function RoleBadge({ role }: { role: (typeof ROLE_BADGE)[OrganizationRole] }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", role.className)}>
      {role.label}
    </Badge>
  )
}

/** Nút hành động trên một dòng. Chỉ render khi dòng đó thực sự xoá được. */
function MemberActions({ displayName, onRemove }: { displayName: string; onRemove: () => void }) {
  return (
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
  )
}

/**
 * Input: trạng thái của truy vấn khi danh sách rỗng.
 * Output: chỗ trống của lần tải đầu, thông báo lỗi, hoặc trạng thái "chưa có ai".
 *
 *         Lần tải đầu để trống hẳn: overlay spinner ở dưới đã nói là đang chờ, thêm chữ nữa thì
 *         hai thứ cùng nói một điều.
 */
function EmptyState({
  isPending,
  error,
  query,
}: {
  isPending: boolean
  error: unknown
  query: string
}) {
  if (isPending) return null

  if (error) {
    return (
      <p className="text-center text-sm text-destructive">
        {getApiErrorMessage(error, "Không tải được danh sách thành viên.")}
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
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
 * Output: Bảng thành viên: ô tìm kiếm, bảng (người / vai trò / ngày tham gia / hành động), chân
 *         phân trang. Dòng của chính mình có nhãn "Bạn".
 *
 *         Phân trang và tìm kiếm đều SERVER-SIDE: `page`, `pageSize`, `q` đi vào URL của
 *         request và cũng là một phần queryKey, nên mỗi trang là một entry cache riêng — quay
 *         lại trang cũ là hiện ngay.
 *
 *         HAI CÁCH TRÌNH BÀY cùng một dữ liệu: từ `sm` trở lên là bảng, dưới `sm` là danh sách
 *         card. Bốn cột ở màn ~360px thì phải kéo ngang mới thấy ngày tham gia và nút hành động;
 *         card xếp dọc thì thấy đủ mà không cuộn. Không dùng mẹo CSS biến `tr/td` thành block:
 *         thứ tự thông tin trên card khác bảng (ngày tụt xuống dòng hai, nút dời lên cạnh tên)
 *         nên cùng markup cũng không ra được bố cục muốn có.
 *
 *         Trình bày bảng chép theo hub (components/globals/data-table.tsx + table-cells.tsx):
 *         khung `rounded-xl border bg-card`, header nền `muted/50` chữ hoa nhỏ, ô
 *         `px-3.5 py-[13px]`, overlay spinner khi đang tải lại — dữ liệu cũ vẫn đọc được trong
 *         lúc chờ. Nhưng KHÔNG mang TanStack Table sang: cột ở đây cố định, phân trang đã do
 *         server làm, nên bộ máy columnDef chỉ là thêm một dependency mà không thêm hành vi nào.
 *
 *         Hành động xoá KHÔNG hiện trên: dòng của chính mình (muốn đi thì dùng "Rời tổ chức" ở
 *         trang Thông tin tổ chức) và dòng chủ tổ chức (BE cũng chặn — ORG_005). Người xem
 *         không phải owner thì cả cột hành động biến mất, không phải một cột nút xám.
 */
export function MembersTable({
  organizationId,
  isOwner,
}: {
  organizationId: string
  isOwner: boolean
}) {
  const currentUserId = useAuthStore((state) => state.user?.userId)
  const { page, setPage, pageSize, setPageSize, search, setSearch, query } = useTableSearch()
  const { data, error, isPending, isFetching } = useOrganizationMembers({
    organizationId,
    page,
    pageSize,
    q: query,
  })
  const [toRemove, setToRemove] = useState<OrganizationMember | null>(null)

  const members = data?.members ?? []
  const pagination = data?.pagination
  const columnCount = isOwner ? 4 : 3
  const emptyState = <EmptyState isPending={isPending} error={error} query={query} />

  return (
    <>
      <div className="flex flex-col gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc email" />

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="relative">
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={HEAD_CLASS}>Thành viên</TableHead>
                    <TableHead className={HEAD_CLASS}>Vai trò</TableHead>
                    <TableHead className={HEAD_CLASS}>Ngày tham gia</TableHead>
                    {isOwner ? <TableHead className={HEAD_CLASS} /> : null}
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {members.length ? (
                    members.map((member) => {
                      const { displayName, role, isSelf, canRemove } = getRowView(
                        member,
                        currentUserId,
                        isOwner,
                      )

                      return (
                        <TableRow key={member.userId}>
                          <TableCell className={CELL_CLASS}>
                            <MemberIdentity
                              displayName={displayName}
                              email={member.email}
                              avatarUrl={member.avatarUrl}
                              isSelf={isSelf}
                            />
                          </TableCell>

                          <TableCell className={CELL_CLASS}>
                            <RoleBadge role={role} />
                          </TableCell>

                          <TableCell className={cn(CELL_CLASS, "text-muted-foreground")}>
                            {formatDate(member.joinedAt)}
                          </TableCell>

                          {isOwner ? (
                            <TableCell className={cn(CELL_CLASS, "w-px text-right")}>
                              {canRemove ? (
                                <MemberActions
                                  displayName={displayName}
                                  onRemove={() => setToRemove(member)}
                                />
                              ) : null}
                            </TableCell>
                          ) : null}
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={columnCount} className="h-60">
                        {emptyState}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="sm:hidden">
              {members.length ? (
                <div className="divide-y">
                  {members.map((member) => {
                    const { displayName, role, isSelf, canRemove } = getRowView(
                      member,
                      currentUserId,
                      isOwner,
                    )

                    return (
                      <div key={member.userId} className="flex flex-col gap-2 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <MemberIdentity
                            displayName={displayName}
                            email={member.email}
                            avatarUrl={member.avatarUrl}
                            isSelf={isSelf}
                          />
                          {canRemove ? (
                            <div className="ml-auto shrink-0">
                              <MemberActions
                                displayName={displayName}
                                onRemove={() => setToRemove(member)}
                              />
                            </div>
                          ) : null}
                        </div>

                        {/* Thụt vào đúng bằng avatar + khoảng cách để dòng này thẳng hàng với tên. */}
                        <div
                          className="flex items-center gap-2 text-[11.5px] text-muted-foreground"
                          style={{ paddingLeft: AVATAR_SIZE + 12 }}
                        >
                          <RoleBadge role={role} />
                          <span>Tham gia {formatDate(member.joinedAt)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid h-60 place-items-center px-4">{emptyState}</div>
              )}
            </div>

            {isFetching ? (
              <div className="absolute inset-0 z-10 grid place-items-center bg-background/55 backdrop-blur-[1px]">
                <Spinner className="size-9 text-primary" />
              </div>
            ) : null}
          </div>

          {pagination ? (
            <TablePagination
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalItems={pagination.totalItems}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>

      <RemoveMemberDialog
        organizationId={organizationId}
        member={toRemove}
        onClose={() => setToRemove(null)}
      />
    </>
  )
}
