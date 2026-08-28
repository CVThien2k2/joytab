"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { AvatarUpload } from "@/components/common/avatar-upload"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useUpdateProfile } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/providers/auth-store-provider"
import { MAX_FULL_NAME_LENGTH } from "@/schema/onboarding"
import { profileFormSchema } from "@/schema/profile"
import type { Gender } from "@/types/onboarding"
import type { ProfileFormPayload, ProfileFormValues } from "@/types/profile"

const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = [
  { value: "male", label: "Nam" },
  { value: "female", label: "Nữ" },
  { value: "other", label: "Khác" },
]

/**
 * Input: Không nhận props — user lấy từ store (layout đã bơm vào từ /auth/me).
 * Output: Một thẻ gồm ảnh đại diện (đổi/xoá) và form tên/tuổi/giới tính/SĐT; email hiện dạng
 *         chỉ đọc.
 *
 *         Avatar lưu NGAY khi upload xong, không chờ bấm "Lưu": nó không phải một field của
 *         form (file đã nằm trên S3 rồi), và để user bấm Lưu mới ghi URL thì bỏ trang giữa
 *         đường là có file mồ côi mà avatar vẫn như cũ.
 *
 *         Email và cách đăng nhập không sửa được: chúng là danh tính do Google cấp, đổi ở đây
 *         thì không còn khớp với tài khoản dùng để đăng nhập.
 *
 *         Dùng LẠI schema của onboarding (xem schema/profile.ts) nên luật validate và cách
 *         chuẩn hoá SĐT giống hệt bước khai lần đầu.
 */
export function ProfileForm() {
  const profile = useAuthStore((state) => state.user?.user)
  const mutation = useUpdateProfile()

  // Dùng cho CẢ useForm và `defaultValue` của từng input: `register` không trả về value nên chỉ
  // đưa vào useForm thì HTML server sinh ra là input rỗng, react-hook-form điền sau khi hydrate
  // — user thấy chữ nháy một nhịp.
  const defaults: ProfileFormValues = {
    fullName: profile?.fullName ?? "",
    age: profile?.age != null ? String(profile.age) : "",
    gender: profile?.gender ?? "",
    phone: profile?.phone ?? "",
  }

  const form = useForm<ProfileFormValues, unknown, ProfileFormPayload>({
    resolver: zodResolver(profileFormSchema),
    // Rời field mới báo lỗi, sau đó bám theo từng ký tự — báo ngay ký tự đầu là quấy rầy.
    mode: "onTouched",
    defaultValues: defaults,
  })

  if (!profile) return null

  const displayName = profile.fullName?.trim() || profile.email

  return (
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      <section className="p-4">
        <h2 className="text-sm font-semibold">Ảnh đại diện</h2>
        <div className="mt-4">
          <AvatarUpload
            name={displayName}
            value={profile.avatarUrl}
            folder="avatars"
            disabled={mutation.isPending}
            onUploaded={(publicUrl) => mutation.mutate({ avatarUrl: publicUrl })}
            onRemove={() => mutation.mutate({ avatarUrl: null })}
          />
        </div>
      </section>

      <section className="p-4">
        <h2 className="text-sm font-semibold">Thông tin cá nhân</h2>

        <form
          className="mt-4"
          onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))}
          noValidate
        >
          {/* fieldset disabled khoá mọi control bằng một chỗ duy nhất — không phải rắc
              `disabled` lên từng field rồi quên một cái. */}
          <fieldset disabled={mutation.isPending} className="contents">
            {/* Hai cột từ `sm` trở lên: form dùng hết chiều rộng thẻ, nhưng không kéo một ô
                input dài suốt màn hình rộng — ô càng dài thì mắt càng khó bắt đầu và kết thúc
                của nó. Email chiếm cả hàng vì nó chỉ đọc, không cần đứng cạnh field nào. */}
            <FieldGroup className="grid gap-5 sm:grid-cols-2">
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

              <Field>
                <FieldLabel htmlFor="phone">Số điện thoại</FieldLabel>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={defaults.phone}
                  maxLength={15}
                  placeholder="0912 345 678"
                  aria-invalid={!!form.formState.errors.phone}
                  {...form.register("phone")}
                />
                <FieldError errors={[form.formState.errors.phone]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="age">Tuổi</FieldLabel>
                {/* type="text" + inputMode numeric: type="number" cho gõ "e"/"+" và trả "" cho
                    mọi input không parse được, mất luôn thứ user đã gõ. */}
                <Input
                  id="age"
                  type="text"
                  inputMode="numeric"
                  defaultValue={defaults.age}
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={mutation.isPending}
                    >
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

              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" value={profile.email} readOnly disabled />
                <FieldDescription>
                  Email đến từ tài khoản Google bạn dùng để đăng nhập, không sửa được ở đây.
                </FieldDescription>
              </Field>

              <div className="sm:col-span-2">
                <Button type="submit">
                  {mutation.isPending ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Check aria-hidden="true" />
                  )}
                  {mutation.isPending ? "Đang lưu" : "Lưu thay đổi"}
                </Button>
              </div>
            </FieldGroup>
          </fieldset>
        </form>
      </section>
    </div>
  )
}
