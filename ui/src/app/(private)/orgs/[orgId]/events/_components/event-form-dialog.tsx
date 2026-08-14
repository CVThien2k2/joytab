"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { NumberInput } from "@/components/common/number-input"
import { Input } from "@/components/ui/input"
import { fromVnDateTimeLocal, toVnDateTimeLocal } from "@/lib/format"
import { eventFormSchema } from "@/schema/event"
import type { EventFormValues, EventSummary } from "@/types/event"
import type { EventInput } from "@/api/events"

/**
 * Input: Không nhận tham số.
 * Output: Giá trị mặc định — buổi đánh 19:00–21:00 của ngày mai, theo giờ VN.
 */
function buildDefaultValues(): EventFormValues {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const date = toVnDateTimeLocal(tomorrow).slice(0, 10)

  return {
    title: "",
    startAt: `${date}T19:00`,
    endAt: `${date}T21:00`,
    locationName: "",
    courtCost: 0,
    maxParticipants: 12,
    voteLockMinutesBefore: 120,
  }
}

type EventFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có event = sửa; không có = tạo mới. */
  event?: EventSummary
  isPending: boolean
  onSubmit: (input: EventInput) => void
}

/**
 * Input: Buổi đánh cần sửa (nếu có) và handler submit.
 * Output: Dialog tạo/sửa buổi đánh lẻ, ngoài lịch định kỳ.
 *
 * `datetime-local` không mang múi giờ nên mọi giá trị vào/ra đều đi qua bộ đổi `+07:00` —
 * để nguyên là lệch đúng 7 tiếng.
 */
export function EventFormDialog({
  open,
  onOpenChange,
  event,
  isPending,
  onSubmit,
}: EventFormDialogProps) {
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: buildDefaultValues(),
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      event
        ? {
            title: event.title,
            startAt: toVnDateTimeLocal(event.startAt),
            endAt: toVnDateTimeLocal(event.endAt),
            locationName: event.locationName ?? "",
            courtCost: event.courtCost,
            maxParticipants: event.maxParticipants,
            voteLockMinutesBefore: Math.max(
              0,
              Math.round(
                (event.startAt.getTime() - event.voteLockedAt.getTime()) / 60000,
              ),
            ),
          }
        : buildDefaultValues(),
    )
  }, [open, event, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Sửa buổi đánh" : "Tạo buổi đánh"}</DialogTitle>
          <DialogDescription>
            Buổi đánh lẻ, không gắn với lịch định kỳ nào.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="event-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              onSubmit({
                title: values.title,
                startAt: fromVnDateTimeLocal(values.startAt),
                endAt: fromVnDateTimeLocal(values.endAt),
                locationName: values.locationName || undefined,
                courtCost: values.courtCost,
                maxParticipants: values.maxParticipants,
                voteLockMinutesBefore: values.voteLockMinutesBefore,
              }),
            )}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên buổi đánh</FormLabel>
                  <FormControl>
                    <Input placeholder="Đánh bù cuối tuần" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bắt đầu</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kết thúc</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
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
          </form>
        </Form>

        <DialogFooter>
          <Button type="submit" form="event-form" disabled={isPending}>
            {isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
