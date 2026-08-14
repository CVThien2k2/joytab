"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { useEffect } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
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
import { Separator } from "@/components/ui/separator"
import { useFinalizeEvent, useUpdateEvent } from "@/hooks/use-events"
import { formatMoney } from "@/lib/format"
import { previewSplit } from "@/lib/money-split"
import { finalizeFormSchema } from "@/schema/event"
import type { EventDetail, FinalizeFormValues } from "@/types/event"

type FinalizeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  event: EventDetail
}

/**
 * Input: Buổi đánh đang mở.
 * Output: Dialog nhập chi phí, xem trước chia tiền rồi chốt sổ.
 *
 * Lưu chi phí và chốt sổ là hai request nối nhau: PATCH ghi lại tiền sân + chi phí phát
 * sinh, rồi POST finalize để BE tính chia trong transaction. Số hiển thị ở đây chỉ là xem
 * trước — con số chính thức do BE tính lại.
 */
export function FinalizeDialog({
  open,
  onOpenChange,
  orgId,
  event,
}: FinalizeDialogProps) {
  const updateEvent = useUpdateEvent(event.id, orgId)
  const finalizeEvent = useFinalizeEvent(event.id, orgId)

  const form = useForm<FinalizeFormValues>({
    resolver: zodResolver(finalizeFormSchema),
    defaultValues: { courtCost: event.courtCost, extraCosts: event.extraCosts },
  })
  const extraCosts = useFieldArray({ control: form.control, name: "extraCosts" })
  const watched = useWatch({ control: form.control })

  useEffect(() => {
    if (!open) return
    form.reset({ courtCost: event.courtCost, extraCosts: event.extraCosts })
  }, [open, event, form])

  const attendees = event.attendances.filter((item) => item.attended === true)
  const total =
    Number(watched.courtCost ?? 0) +
    (watched.extraCosts ?? []).reduce(
      (sum, cost) => sum + Number(cost?.amount ?? 0),
      0,
    )
  const shares = previewSplit(total, attendees.length)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chốt sổ và chia tiền</DialogTitle>
          <DialogDescription>
            Chỉ những người được chấm thực tế có mặt mới bị chia tiền.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="finalize-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              updateEvent.mutate(
                { courtCost: values.courtCost, extraCosts: values.extraCosts },
                { onSuccess: () => finalizeEvent.mutate(undefined, {
                  onSuccess: () => onOpenChange(false),
                }) },
              ),
            )}
          >
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Chi phí phát sinh</FormLabel>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => extraCosts.append({ name: "", amount: 0 })}
                >
                  <Plus className="size-4" />
                  Thêm khoản
                </Button>
              </div>

              {extraCosts.fields.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`extraCosts.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input placeholder="Cầu" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`extraCosts.${index}.amount`}
                    render={({ field }) => (
                      <FormItem className="w-36">
                        <FormControl>
                          <NumberInput {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Xoá khoản"
                    onClick={() => extraCosts.remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </form>
        </Form>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Tổng chi phí</span>
            <span>{formatMoney(total)}</span>
          </div>

          {attendees.length === 0 ? (
            <p className="text-destructive text-sm">
              Chưa chấm ai thực tế có mặt — quay lại tick điểm danh rồi lưu trước đã.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">
                Xem trước chia cho {attendees.length} người
              </p>
              {attendees.map((attendee, index) => (
                <div
                  key={attendee.userId}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">
                    {attendee.fullName ?? attendee.email}
                  </span>
                  <span>{formatMoney(shares[index] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="submit"
            form="finalize-form"
            disabled={
              attendees.length === 0 ||
              updateEvent.isPending ||
              finalizeEvent.isPending
            }
          >
            {updateEvent.isPending || finalizeEvent.isPending
              ? "Đang chốt sổ…"
              : "Chốt sổ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
