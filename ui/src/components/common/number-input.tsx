"use client"

import type { ComponentProps } from "react"
import { Input } from "@/components/ui/input"

type NumberInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange" | "type"
> & {
  value: number
  onChange: (value: number) => void
}

/**
 * Input: Giá trị số và handler nhận số.
 * Output: `<input type="number">` luôn trả về SỐ chứ không phải chuỗi.
 *
 * Tồn tại vì `<Input {...field} />` mặc định đẩy `event.target.value` (chuỗi) vào form, còn
 * schema khai `z.number()` — mọi ô số sẽ báo lỗi validate dù người dùng gõ đúng. Ô rỗng cho
 * ra NaN có chủ ý: đó là cách schema phân biệt "chưa nhập" với số 0.
 */
export function NumberInput({ value, onChange, ...props }: NumberInputProps) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      value={Number.isNaN(value) ? "" : value}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? Number.NaN : event.target.valueAsNumber,
        )
      }
      {...props}
    />
  )
}
