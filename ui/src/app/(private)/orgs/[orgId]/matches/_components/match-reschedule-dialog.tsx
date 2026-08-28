"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ArrowRight } from "lucide-react"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import type { MatchMoveRequest } from "@/components/common/match-calendar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUpdateMatch } from "@/hooks/use-matches-api"
import { toDateInput, toIso, toTimeInput } from "@/lib/date-input"
import { formatDateTime, formatTime } from "@/lib/format"
import { matchRescheduleFormSchema } from "@/schema/match"
import type { MatchRescheduleValues } from "@/types/match"

export type MatchRescheduleDialogProps = {
  organizationId: string
  /** Lần kéo thả đang chờ xác nhận; `null` = không có gì để hỏi. */
  request: MatchMoveRequest | null
  /** Đóng dialog. `committed` = đã lưu xong, KHÔNG được trả chip về chỗ cũ nữa. */
  onClose: (committed: boolean) => void
}

/**
 * Input: một lần kéo thả vừa xong + tổ chức của trận.
 * Output: Dialog xác nhận lại ngày giờ trước khi thật sự lưu.
 *
 *         Kéo thả là thao tác dễ lỡ tay nhất trên trang này: lệch một ô là lệch nửa tiếng,
 *         lệch một cột là lệch cả ngày, mà chip thì đã nằm ở chỗ mới nên nhìn vào không biết
 *         mình có kéo nhầm hay không. Nên nó KHÔNG tự lưu — nó hỏi lại, và hỏi bằng số chứ
 *         không bằng vị trí.
 *
 *         Ba đường thoát (Huỷ, Esc, bấm ra ngoài) đều phải trả chip về chỗ cũ. Không trả thì
 *         màn hình đang hiển thị một lịch mà server không có — kiểu sai không ai báo mà ai
 *         cũng thấy.
 *
 *         Ngày giờ ở đây SỬA ĐƯỢC chứ không chỉ để đọc: kéo tới gần đúng rồi gõ cho chính xác
 *         nhanh hơn là kéo đi kéo lại cho trúng ô 30 phút.
 */
export function MatchRescheduleDialog({
  organizationId,
  request,
  onClose,
}: MatchRescheduleDialogProps) {
  const form = useForm<MatchRescheduleValues>({
    resolver: zodResolver(matchRescheduleFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { date: "", startTime: "", endTime: "" },
  })

  // Mỗi lần kéo là một câu hỏi mới. Không reset thì lần kéo thứ hai vẫn hiện giờ của lần đầu,
  // và người ta sẽ bấm "Lưu" cho một giờ không phải giờ vừa kéo tới.
  useEffect(() => {
    if (!request) return
    form.reset({
      date: toDateInput(request.start),
      startTime: toTimeInput(request.start),
      endTime: toTimeInput(request.end),
    })
    // form là instance ổn định của react-hook-form; đưa vào deps chỉ làm effect chạy lại vô ích.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

  const updateMatch = useUpdateMatch(organizationId, { onSuccess: () => onClose(true) })

  function submit(values: MatchRescheduleValues): void {
    if (!request) return
    updateMatch.mutate(
      {
        matchId: request.match.id,
        payload: {
          startAt: toIso(values.date, values.startTime),
          endAt: toIso(values.date, values.endTime),
        },
      },
      // Server từ chối (trận vừa bị huỷ, vừa được chốt tiền) thì chip phải nhảy về đúng chỗ
      // cũ. Toast lỗi do chính hook lo.
      { onError: () => onClose(false) },
    )
  }

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(next) => {
        if (next || updateMatch.isPending) return
        onClose(false)
      }}
    >
      <DialogContent className="sm:max-w-md">
        {updateMatch.isPending ? <LoadingOverlay label="Đang dời lịch" /> : null}
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <fieldset disabled={updateMatch.isPending} className="contents">
            <DialogHeader>
              <DialogTitle>Xác nhận dời lịch</DialogTitle>
              <DialogDescription>
                {request ? `Trận tại ${request.match.courtName}.` : null} Kiểm tra lại ngày giờ
                trước khi lưu — huỷ thì trận trở về chỗ cũ.
              </DialogDescription>
            </DialogHeader>

            {request ? (
              <p className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
                <span className="text-muted-foreground line-through">
                  {formatDateTime(request.match.startAt)} - {formatTime(request.match.endAt)}
                </span>
                <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="font-medium">
                  {formatDateTime(request.start.toISOString())} -{" "}
                  {formatTime(request.end.toISOString())}
                </span>
              </p>
            ) : null}

            <div className="my-5 space-y-4">
              <Field>
                <FieldLabel htmlFor="reschedule-date">Ngày</FieldLabel>
                <Input
                  id="reschedule-date"
                  type="date"
                  aria-invalid={!!form.formState.errors.date}
                  {...form.register("date")}
                />
                <FieldError errors={[form.formState.errors.date]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="reschedule-start">Bắt đầu</FieldLabel>
                  <Input
                    id="reschedule-start"
                    type="time"
                    aria-invalid={!!form.formState.errors.startTime}
                    {...form.register("startTime")}
                  />
                  <FieldError errors={[form.formState.errors.startTime]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="reschedule-end">Kết thúc</FieldLabel>
                  <Input
                    id="reschedule-end"
                    type="time"
                    aria-invalid={!!form.formState.errors.endTime}
                    {...form.register("endTime")}
                  />
                  <FieldError errors={[form.formState.errors.endTime]} />
                </Field>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose(false)}>
                Huỷ
              </Button>
              <Button type="submit">Lưu lịch mới</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
