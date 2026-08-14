"use client"

import { CalendarPlus, MoreHorizontal, Plus } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
  useCreateTemplate,
  useDeleteTemplate,
  useGenerateFromTemplate,
  useTemplates,
  useUpdateTemplate,
} from "@/hooks/use-events"
import { DAY_OF_WEEK_LABELS, formatMoney, formatTimeOfDay } from "@/lib/format"
import type { EventTemplate } from "@/types/event"
import { TemplateFormDialog } from "./template-form-dialog"

/**
 * Input: orgId.
 * Output: Màn lịch định kỳ — CRUD + nút sinh bù buổi đánh ngay thay vì chờ cron 01:00.
 */
export function TemplatesPanel({ orgId }: { orgId: string }) {
  const { data: templates, isPending } = useTemplates(orgId)
  const createTemplate = useCreateTemplate(orgId)
  const updateTemplate = useUpdateTemplate(orgId)
  const deleteTemplate = useDeleteTemplate(orgId)
  const generate = useGenerateFromTemplate(orgId)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EventTemplate | undefined>(undefined)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch định kỳ</CardTitle>
        <CardDescription>
          Mỗi lịch tự sinh buổi đánh cho 14 ngày tới, chạy lúc 01:00 hằng ngày.
        </CardDescription>
        <CardAction>
          <Button
            onClick={() => {
              setEditing(undefined)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            Thêm lịch
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : templates && templates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lịch</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Sân</TableHead>
                <TableHead>Tiền sân</TableHead>
                <TableHead>Sĩ số</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    {DAY_OF_WEEK_LABELS[template.dayOfWeek]} ·{" "}
                    {formatTimeOfDay(template.startTime)}–
                    {formatTimeOfDay(template.endTime)}
                  </TableCell>
                  <TableCell>{template.locationName ?? "—"}</TableCell>
                  <TableCell>{formatMoney(template.courtCost)}</TableCell>
                  <TableCell>{template.maxParticipants}</TableCell>
                  <TableCell>
                    <Badge variant={template.active ? "default" : "secondary"}>
                      {template.active ? "Đang bật" : "Đã tắt"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Thao tác">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() => {
                            setEditing(template)
                            setDialogOpen(true)
                          }}
                        >
                          Sửa
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => generate.mutate(template.id)}
                        >
                          <CalendarPlus className="size-4" />
                          Sinh buổi đánh ngay
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => deleteTemplate.mutate(template.id)}
                        >
                          Xoá lịch
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            Chưa có lịch nào. Thêm lịch để hệ thống tự tạo buổi đánh hằng tuần.
          </p>
        )}
      </CardContent>

      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editing}
        isPending={createTemplate.isPending || updateTemplate.isPending}
        onSubmit={(input) => {
          const options = { onSuccess: () => setDialogOpen(false) }
          if (editing) {
            updateTemplate.mutate({ templateId: editing.id, input }, options)
          } else {
            createTemplate.mutate(input, options)
          }
        }}
      />
    </Card>
  )
}
