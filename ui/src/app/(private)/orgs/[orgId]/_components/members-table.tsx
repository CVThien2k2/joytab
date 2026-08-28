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
import { useAuthStore } from "@/providers/auth-store-provider"
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

/**
 * Input: id tổ chức + người xem có phải owner không.
 * Output: Bảng thành viên: ô tìm kiếm, bảng (người / vai trò / ngày tham gia / hành động), chân
 *         phân trang. Dòng của chính mình có nhãn "Bạn".
 *
 *         Phân trang và tìm kiếm đều SERVER-SIDE: `page`, `pageSize`, `q` đi vào URL của
 *         request và cũng là một phần queryKey, nên mỗi trang là một entry cache riêng — quay
 *         lại trang cũ là hiện ngay.
 *
 *         Trình bày chép theo hub (components/globals/data-table.tsx + table-cells.tsx): khung
 *         `rounded-xl border bg-card`, header nền `muted/50` chữ hoa nhỏ, ô `px-3.5 py-[13px]`,
 *         overlay spinner khi đang tải lại — dữ liệu cũ vẫn đọc được trong lúc chờ.
 *         Nhưng KHÔNG mang TanStack Table sang: cột ở đây cố định, phân trang đã do server làm,
 *         nên bộ máy columnDef chỉ là thêm một dependency mà không thêm hành vi nào.
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

  return (
    <>
      <div className="flex flex-col gap-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc email" />

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="relative">
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
                    const displayName = member.fullName?.trim() || member.email
                    const role = ROLE_BADGE[member.role]
                    const isSelf = member.userId === currentUserId
                    const canRemove = isOwner && !isSelf && member.role !== "owner"

                    return (
                      <TableRow key={member.userId}>
                        <TableCell className={CELL_CLASS}>
                          <div className="flex items-center gap-3">
                            <AccountAvatar name={displayName} src={member.avatarUrl} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 font-medium">
                                <span className="truncate">{displayName}</span>
                                {isSelf ? (
                                  <Badge variant="outline" className="shrink-0">
                                    Bạn
                                  </Badge>
                                ) : null}
                              </div>
                              <div className="truncate text-[11.5px] text-muted-foreground">
                                {member.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className={CELL_CLASS}>
                          <Badge
                            variant="outline"
                            className={cn("border-transparent", role.className)}
                          >
                            {role.label}
                          </Badge>
                        </TableCell>

                        <TableCell className={cn(CELL_CLASS, "text-muted-foreground")}>
                          {formatDate(member.joinedAt)}
                        </TableCell>

                        {isOwner ? (
                          <TableCell className={cn(CELL_CLASS, "w-px text-right")}>
                            {canRemove ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Hành động với ${displayName}`}
                                  >
                                    <MoreHorizontal aria-hidden="true" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => setToRemove(member)}
                                  >
                                    <Trash2 aria-hidden="true" />
                                    Xoá khỏi tổ chức
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount} className="h-60">
                      {/* Lần tải đầu để trống hẳn: overlay spinner ở dưới đã nói là đang chờ,
                          thêm chữ nữa thì hai thứ cùng nói một điều. */}
                      {isPending ? null : error ? (
                        <p className="text-center text-sm text-destructive">
                          {getApiErrorMessage(error, "Không tải được danh sách thành viên.")}
                        </p>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-4 text-center">
                          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                            <Inbox className="size-6" aria-hidden="true" />
                          </div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {query ? `Không có ai khớp "${query}"` : "Chưa có thành viên nào"}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

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
