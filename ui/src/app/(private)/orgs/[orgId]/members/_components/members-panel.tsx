"use client"

import { MoreHorizontal } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  useMembers,
  useRemoveMember,
  useUpdateMemberRole,
} from "@/hooks/use-organizations"
import { formatDate } from "@/lib/format"
import { useAuthStore } from "@/stores/auth-store"
import type { Member } from "@/types/organization"

/**
 * Input: Thành viên.
 * Output: Hai chữ cái đầu để làm avatar dự phòng khi không có ảnh.
 */
function getInitials(member: Member): string {
  const source = member.fullName ?? member.email
  return source.slice(0, 2).toUpperCase()
}

/**
 * Input: orgId.
 * Output: Bảng thành viên với thao tác đổi quyền / mời ra khỏi nhóm.
 *
 * Không tự chặn "admin cuối cùng" ở FE: BE đã có bất biến đó (ORG_004) và nó là nơi duy
 * nhất biết chắc, FE chỉ hiển thị lại thông báo.
 */
export function MembersPanel({ orgId }: { orgId: string }) {
  const { data: members, isPending } = useMembers(orgId)
  const updateRole = useUpdateMemberRole(orgId)
  const removeMember = useRemoveMember(orgId)
  const myUserId = useAuthStore((state) => state.user?.userId)
  const [pendingRemoval, setPendingRemoval] = useState<Member | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thành viên</CardTitle>
        <CardDescription>
          {members ? `${members.length} người đang tham gia` : "Đang tải…"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thành viên</TableHead>
                <TableHead>Quyền</TableHead>
                <TableHead>Tham gia</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.userId}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        {member.avatarUrl ? (
                          <AvatarImage src={member.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback>{getInitials(member)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.fullName ?? member.email}
                          {member.userId === myUserId ? " (bạn)" : ""}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.role === "ADMIN" ? "default" : "secondary"}
                    >
                      {member.role === "ADMIN" ? "Quản trị" : "Thành viên"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(member.joinedAt)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Thao tác">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            updateRole.mutate({
                              userId: member.userId,
                              role: member.role === "ADMIN" ? "MEMBER" : "ADMIN",
                            })
                          }
                        >
                          {member.role === "ADMIN"
                            ? "Hạ xuống thành viên"
                            : "Nâng lên quản trị"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setPendingRemoval(member)}
                        >
                          Xoá khỏi nhóm
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá khỏi nhóm?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemoval?.fullName ?? pendingRemoval?.email} sẽ không xem được
              lịch đánh nữa. Lịch sử điểm danh và công nợ cũ vẫn được giữ nguyên.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRemoval) removeMember.mutate(pendingRemoval.userId)
                setPendingRemoval(null)
              }}
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
