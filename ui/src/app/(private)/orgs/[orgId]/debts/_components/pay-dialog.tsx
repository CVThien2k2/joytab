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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { NumberInput } from "@/components/common/number-input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { useCreatePayment } from "@/hooks/use-billing"
import { formatMoney } from "@/lib/format"
import { paymentFormSchema } from "@/schema/billing"
import type { PaymentFormValues } from "@/types/billing"

type PayDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  /** Tổng còn nợ, dùng làm số tiền gợi ý sẵn. */
  remaining: number
  /** ADMIN thu tiền hộ thì truyền userId người nợ; MEMBER để trống. */
  payerUserId?: string
  payerName?: string
}

/**
 * Input: orgId và số tiền còn nợ.
 * Output: Dialog báo đã trả tiền.
 *
 * Không cho chọn trả cho buổi nào: BE tự phân bổ nợ cũ trước, đúng thứ tự `start_at`. Cho
 * người dùng tự chọn chỉ đẻ ra lỗi PAY_004 mà không giải quyết vấn đề gì thật.
 */
export function PayDialog({
  open,
  onOpenChange,
  orgId,
  remaining,
  payerUserId,
  payerName,
}: PayDialogProps) {
  const createPayment = useCreatePayment(orgId)
  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      amount: remaining,
      method: "CASH",
      note: "",
      userId: payerUserId ?? "",
    },
  })

  useEffect(() => {
    if (!open) return
    form.reset({
      amount: remaining,
      method: "CASH",
      note: "",
      userId: payerUserId ?? "",
    })
  }, [open, remaining, payerUserId, form])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {payerName ? `Ghi nhận thanh toán của ${payerName}` : "Báo đã trả tiền"}
          </DialogTitle>
          <DialogDescription>
            Còn nợ {formatMoney(remaining)}. Tiền được trừ vào các buổi cũ trước.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="pay-form"
            className="space-y-4"
            onSubmit={form.handleSubmit((values) =>
              createPayment.mutate(
                {
                  amount: values.amount,
                  method: values.method,
                  note: values.note || undefined,
                  userId: values.userId || undefined,
                },
                { onSuccess: () => onOpenChange(false) },
              ),
            )}
          >
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Số tiền (₫)</FormLabel>
                  <FormControl>
                    <NumberInput {...field} />
                  </FormControl>
                  <FormDescription>
                    Không được vượt quá tổng còn nợ.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hình thức</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-6"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="CASH" id="method-cash" />
                        <label htmlFor="method-cash" className="text-sm">
                          Tiền mặt
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="BANK_TRANSFER" id="method-bank" />
                        <label htmlFor="method-bank" className="text-sm">
                          Chuyển khoản
                        </label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ghi chú</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Chuyển khoản lúc 20:00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button type="submit" form="pay-form" disabled={createPayment.isPending}>
            {createPayment.isPending ? "Đang gửi…" : "Gửi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
