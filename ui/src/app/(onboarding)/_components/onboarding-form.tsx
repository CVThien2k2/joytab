"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCompleteOnboarding } from "@/hooks/use-onboarding-api"
import { useAuthStore } from "@/providers/auth-store-provider"
import { MAX_FULL_NAME_LENGTH, onboardingFormSchema } from "@/schema/onboarding"
import type { Gender, OnboardingFormValues, OnboardingPayload } from "@/types/onboarding"

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
]

/**
 * Input: Không nhận props — user lấy từ store (layout đã bơm vào từ /auth/me).
 * Output: Form xác nhận tên, tuổi, giới tính, SĐT. Cả 4 field bắt buộc.
 *
 * `useForm` nhận 3 generic: giá trị form (toàn string, vì input HTML chỉ trả string), context,
 * và giá trị SAU transform của schema (`age` là number, `gender` là union) — nhờ vậy
 * `handleSubmit` đưa thẳng payload đúng kiểu cho mutation, không cần map tay.
 *
 * `mode: "onTouched"` thay vì "onChange": báo lỗi ngay ký tự đầu tiên khi user còn đang gõ là
 * quấy rầy vô ích; rời field mới báo, sau đó thì cập nhật theo từng lần gõ.
 */
export function OnboardingForm() {
  // Store giữ cả envelope { userId, user }; ở đây chỉ cần phần profile để điền sẵn form.
  const profile = useAuthStore((state) => state.user?.user)
  const mutation = useCompleteOnboarding()

  // Dùng cho CẢ useForm và attribute `defaultValue` của từng input. `register` không trả về
  // value/defaultValue nên nếu chỉ đưa vào useForm thì HTML do server sinh ra là input rỗng,
  // react-hook-form mới điền vào sau khi hydrate — user thấy tên nháy một nhịp.
  const defaults: OnboardingFormValues = {
    fullName: profile?.fullName ?? "",
    age: profile?.age != null ? String(profile.age) : "",
    gender: profile?.gender ?? "",
    phone: profile?.phone ?? "",
  }

  const form = useForm<OnboardingFormValues, unknown, OnboardingPayload>({
    resolver: zodResolver(onboardingFormSchema),
    mode: "onTouched",
    defaultValues: defaults,
  })

  // Giữ khoá form cả trong lúc điều hướng sau khi lưu xong (isSuccess): mutation đã hết
  // pending nhưng router.replace("/") còn đang chạy, mở lại form lúc đó chỉ tạo cơ hội
  // submit lần hai.
  const isBusy = mutation.isPending || mutation.isSuccess

  // Hai nhịp chờ khác nhau nên nói khác nhau (kiểu hub: "Đang đăng nhập" / "Đang kiểm tra"):
  // lưu xong rồi mà nút vẫn ghi "Đang lưu" thì user tưởng bị treo, trong khi thật ra đang
  // chờ trang sau tải.
  const submitLabel = mutation.isSuccess
    ? "Đang chuyển vào Joytab"
    : mutation.isPending
      ? "Đang lưu"
      : "Hoàn tất"

  return (
    <form onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))} noValidate>
      {/* fieldset disabled khoá mọi control bên trong bằng một chỗ duy nhất — không phải rắc
          `disabled` lên từng field và quên một cái. */}
      <fieldset disabled={isBusy} className="contents">
        <FieldGroup className="gap-5">
          <Field>
            <FieldLabel htmlFor="fullName">Họ và tên</FieldLabel>
            <Input
              id="fullName"
              autoComplete="name"
              defaultValue={defaults.fullName}
              maxLength={MAX_FULL_NAME_LENGTH}
              placeholder="Nguyễn Văn A"
              aria-invalid={!!form.formState.errors.fullName}
              {...form.register("fullName")}
            />
            <FieldError errors={[form.formState.errors.fullName]} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="age">Tuổi</FieldLabel>
              {/* type="text" + inputMode numeric: type="number" cho gõ được "e"/"+" và trả ""
                  cho mọi input không parse được, mất luôn thứ user đã gõ. */}
              <Input
                id="age"
                type="text"
                defaultValue={defaults.age}
                inputMode="numeric"
                maxLength={3}
                placeholder="25"
                aria-invalid={!!form.formState.errors.age}
                {...form.register("age")}
              />
              <FieldError errors={[form.formState.errors.age]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="gender">Giới tính</FieldLabel>
              <Controller
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={isBusy}>
                    <SelectTrigger
                      id="gender"
                      className="w-full"
                      ref={field.ref}
                      onBlur={field.onBlur}
                      aria-invalid={!!form.formState.errors.gender}
                    >
                      <SelectValue placeholder="Chọn" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[form.formState.errors.gender]} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="phone">Số điện thoại</FieldLabel>
            <Input
              id="phone"
              type="tel"
              defaultValue={defaults.phone}
              autoComplete="tel"
              maxLength={15}
              placeholder="0912 345 678"
              aria-invalid={!!form.formState.errors.phone}
              {...form.register("phone")}
            />
            <FieldError errors={[form.formState.errors.phone]} />
          </Field>

          <Button type="submit" size="lg" className="w-full rounded-xl text-sm font-semibold">
            {isBusy ? <Spinner className="size-4" /> : <Check aria-hidden="true" />}
            {submitLabel}
          </Button>
        </FieldGroup>
      </fieldset>
    </form>
  )
}
