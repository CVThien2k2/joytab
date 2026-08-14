"use client"

import { Plus, Users } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganizations } from "@/hooks/use-organizations"

/**
 * Input: Không nhận props.
 * Output: Danh sách nhóm tôi tham gia + nút tạo nhóm. Chưa có nhóm nào thì hiện lối vào duy
 *         nhất là tạo nhóm — người được mời sẽ tới qua link mời chứ không tìm ở đây.
 */
export function OrganizationList() {
  const { data: organizations, isPending, isError } = useOrganizations()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Nhóm của tôi</h1>
          <p className="text-muted-foreground text-sm">
            Chọn một nhóm để xem lịch đánh và công nợ.
          </p>
        </div>
        <Button asChild>
          <Link href="/orgs/new">
            <Plus className="size-4" />
            Tạo nhóm
          </Link>
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError ? (
        <p className="text-destructive text-sm">
          Không tải được danh sách nhóm. Thử lại sau.
        </p>
      ) : organizations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Chưa có nhóm nào</CardTitle>
            <CardDescription>
              Tạo nhóm đầu tiên rồi gửi link mời cho anh em cùng đánh.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {organizations.map((organization) => (
            <Link key={organization.id} href={`/orgs/${organization.id}`}>
              <Card className="hover:border-primary transition-colors">
                <CardHeader>
                  <CardTitle>{organization.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {organization.memberCount} thành viên
                  </CardDescription>
                  <CardAction>
                    <Badge
                      variant={
                        organization.myRole === "ADMIN" ? "default" : "secondary"
                      }
                    >
                      {organization.myRole === "ADMIN" ? "Quản trị" : "Thành viên"}
                    </Badge>
                  </CardAction>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
