"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { NumberInput } from "@/components/common/number-input"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { DAY_OF_WEEK_LABELS, formatTimeOfDay } from "@/lib/format"
import { templateFormSchema } from "@/schema/event"
import type { EventTemplate, TemplateFormValues } from "@/types/event"
import type { TemplateInput } from "@/api/events"

const DEFAULT_VALUES: TemplateFormValues = {
  name: "",
  dayOfWeek: "4",
  startTime: "19:00",
  endTime: "21:00",
  locationName: "",
  courtCost: 0,
  maxParticipants: 12,
  voteLockMinutesBefore: 120,
  active: true,
}

type TemplateFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có template = sửa; không có = tạo mới. */
  template?: EventTemplate
  isPending: boolean
  onSubmit: (input: TemplateInput) => void
  trigger?: ReactNode
}

/**
 * Input: Template cần sửa (nếu có) và handler submit.
 * Output: Dialog tạo/sửa lịch định kỳ.
 *
 * Sửa lịch KHÔNG động tới buổi đã sinh — chúng đã copy đủ dữ liệu và sống độc lập.
 */
export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  isPending,
  onSubmit,
  trigger,
}: TemplateFormDialogProps) {
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  // Nạp lại giá trị mỗi lần mở: cùng một dialog được dùng cho cả tạo lẫn sửa nhiều template.
  useEffect(() => {
    if (!open) return
    form.reset(
      template
        ? {
            name: template.name,
            dayOfWeek: String(template.dayOfWeek),
            startTime: formatTimeOfDay(template.startTime),
            endTime: formatTimeOfDay(template.endTime),
            locationName: template.locationName ?? "",
            courtCost: template.courtCost,
            maxParticipants: template.maxParticipants,
            voteLockMinutesBefore: template.voteLockMinutesBefore,
            active: template.active,
          }
        : DEFAULT_VALUES,
    )
  }, [open, template, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{template ? "Sửa lịch định kỳ" : "Thêm lịch định kỳ"}</DialogTitle>
          <DialogDescription>
            Hệ thống tự sinh buổi đánh cho 14 ngày tới theo lịch này.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="template-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              onSubmit({
                name: values.name,
                dayOfWeek: Number(values.dayOfWeek),
                startTime: values.startTime,
                endTime: values.endTime,
                locationName: values.locationName || undefined,
                courtCost: values.courtCost,
                maxParticipants: values.maxParticipants,
                voteLockMinutesBefore: values.voteLockMinutesBefore,
                active: values.active,
              }),
            )}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên lịch</FormLabel>
                  <FormControl>
                    <Input placeholder="Cầu lông tối thứ 5" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="dayOfWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thứ</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(DAY_OF_WEEK_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kết thúc</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="locationName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sân</FormLabel>
                  <FormControl>
                    <Input placeholder="Nhà thi đấu Cầu Giấy" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="courtCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tiền sân (₫)</FormLabel>
                    <FormControl>
                      <NumberInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maxParticipants"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tối đa</FormLabel>
                    <FormControl>
                      <NumberInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="voteLockMinutesBefore"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Khoá trước (phút)</FormLabel>
                    <FormControl>
                      <NumberInput {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Đang bật</FormLabel>
                    <FormDescription>
                      Tắt thì hệ thống ngừng sinh buổi mới từ lịch này.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button type="submit" form="template-form" disabled={isPending}>
            {isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
