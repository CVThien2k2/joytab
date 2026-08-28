"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { useCreateMatch, useUpdateMatch } from "@/hooks/use-matches-api"
import { toDateInput, toIso, toTimeInput } from "@/lib/date-input"
import {
  MAX_COURT_NAME_LENGTH,
  MAX_MATCH_NOTE_LENGTH,
  MAX_MAX_PLAYERS,
  MIN_MAX_PLAYERS,
  matchFormSchema,
} from "@/schema/match"
import type { MatchFormValues, MatchSummary } from "@/types/match"

export type MatchFormDialogProps = {
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Có = đang SỬA trận đó; không có = tạo mới. */
  match?: MatchSummary
  /** Ngày/giờ điền sẵn khi mở từ một ô trống trên lịch. */
  initialStart?: Date
  initialEnd?: Date | null
}

/**
 * Input: tổ chức + (tuỳ chọn) trận đang sửa hoặc ô lịch vừa bấm.
 * Output: Dialog tạo/sửa lịch thi đấu.
 *
 *         Một NGÀY + hai GIỜ chứ không hai ô ngày-giờ: một buổi đá nằm gọn trong một ngày,
 *         bắt chọn ngày hai lần chỉ để hai lần đó luôn giống nhau là bắt làm việc thừa.
 *
 *         Hệ số nam để trống = dùng mặc định của tổ chức. Nói rõ trong nhãn, vì để trống một
 *         ô số mà không biết điều gì xảy ra là chỗ người ta hay khựng lại.
 */
export function MatchFormDialog({
  organizationId,
  open,
  onOpenChange,
  match,
  initialStart,
  initialEnd,
}: MatchFormDialogProps) {
  const isEditing = Boolean(match)

  const form = useForm<MatchFormValues>({
    resolver: zodResolver(matchFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      courtName: "",
      date: toDateInput(new Date()),
      startTime: "19:00",
      endTime: "21:00",
      maxPlayers: 8,
      maleRatio: "",
      note: "",
    },
  })

  // Mỗi lần mở lại phải khớp với thứ vừa bấm: sửa trận nào thì hiện trận đó, bấm ô ngày nào
  // thì điền ngày đó. Không reset ở đây thì lần mở thứ hai vẫn là dữ liệu của lần đầu.
  useEffect(() => {
    if (!open) return

    if (match) {
      const start = new Date(match.startAt)
      const end = new Date(match.endAt)
      form.reset({
        courtName: match.courtName,
        date: toDateInput(start),
        startTime: toTimeInput(start),
        endTime: toTimeInput(end),
        maxPlayers: match.maxPlayers,
        maleRatio: String(match.maleRatio),
        note: match.note ?? "",
      })
      return
    }

    const start = initialStart ?? new Date()
    const end = initialEnd ?? new Date(start.getTime() + 2 * 60 * 60 * 1000)
    form.reset({
      courtName: "",
      date: toDateInput(start),
      // Bấm vào một Ô NGÀY trong lịch tháng thì giờ là 00:00 — vô nghĩa cho một buổi đá, nên
      // rơi về khung giờ hay chơi nhất thay vì bắt người ta sửa từ nửa đêm.
      startTime: initialEnd ? toTimeInput(start) : "19:00",
      endTime: initialEnd ? toTimeInput(end) : "21:00",
      maxPlayers: 8,
      maleRatio: "",
      note: "",
    })
    // form là instance ổn định của react-hook-form; đưa vào deps chỉ làm effect chạy lại vô ích.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, match, initialStart, initialEnd])

  const createMatch = useCreateMatch(organizationId, () => onOpenChange(false))
  const updateMatch = useUpdateMatch(organizationId, { onSuccess: () => onOpenChange(false) })
  const pending = createMatch.isPending || updateMatch.isPending

  function submit(values: MatchFormValues): void {
    const payload = {
      courtName: values.courtName.trim(),
      startAt: toIso(values.date, values.startTime),
      endAt: toIso(values.date, values.endTime),
      maxPlayers: Number(values.maxPlayers),
      ...(values.maleRatio ? { maleRatio: Number(values.maleRatio) } : {}),
      note: values.note.trim(),
    }

    if (match) updateMatch.mutate({ matchId: match.id, payload })
    else createMatch.mutate(payload)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        {pending ? <LoadingOverlay label={isEditing ? "Đang lưu" : "Đang tạo lịch"} /> : null}
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <fieldset disabled={pending} className="contents">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Sửa lịch thi đấu" : "Tạo lịch thi đấu"}</DialogTitle>
              <DialogDescription>
                Thành viên sẽ đăng ký theo lịch này. Đăng ký đóng khi đủ người hoặc tới giờ chơi.
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 space-y-4">
              <Field>
                <FieldLabel htmlFor="courtName">Tên sân</FieldLabel>
                <Input
                  id="courtName"
                  autoComplete="off"
                  maxLength={MAX_COURT_NAME_LENGTH}
                  placeholder="Sân Bách Khoa - sân 3"
                  aria-invalid={!!form.formState.errors.courtName}
                  {...form.register("courtName")}
                />
                <FieldError errors={[form.formState.errors.courtName]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="date">Ngày</FieldLabel>
                <Input
                  id="date"
                  type="date"
                  aria-invalid={!!form.formState.errors.date}
                  {...form.register("date")}
                />
                <FieldError errors={[form.formState.errors.date]} />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="startTime">Bắt đầu</FieldLabel>
                  <Input
                    id="startTime"
                    type="time"
                    aria-invalid={!!form.formState.errors.startTime}
                    {...form.register("startTime")}
                  />
                  <FieldError errors={[form.formState.errors.startTime]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="endTime">Kết thúc</FieldLabel>
                  <Input
                    id="endTime"
                    type="time"
                    aria-invalid={!!form.formState.errors.endTime}
                    {...form.register("endTime")}
                  />
                  <FieldError errors={[form.formState.errors.endTime]} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="maxPlayers">Số người tối đa</FieldLabel>
                  <Input
                    id="maxPlayers"
                    type="number"
                    inputMode="numeric"
                    min={MIN_MAX_PLAYERS}
                    max={MAX_MAX_PLAYERS}
                    aria-invalid={!!form.formState.errors.maxPlayers}
                    {...form.register("maxPlayers")}
                  />
                  <FieldError errors={[form.formState.errors.maxPlayers]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="maleRatio">Hệ số nam</FieldLabel>
                  <Input
                    id="maleRatio"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    placeholder="Theo tổ chức"
                    aria-invalid={!!form.formState.errors.maleRatio}
                    {...form.register("maleRatio")}
                  />
                  <FieldError errors={[form.formState.errors.maleRatio]} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="note">Ghi chú</FieldLabel>
                <Textarea
                  id="note"
                  maxLength={MAX_MATCH_NOTE_LENGTH}
                  placeholder="Vd: mang vợt dự phòng"
                  aria-invalid={!!form.formState.errors.note}
                  {...form.register("note")}
                />
                <FieldError errors={[form.formState.errors.note]} />
              </Field>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Huỷ
              </Button>
              <Button type="submit">{isEditing ? "Lưu thay đổi" : "Tạo lịch"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
