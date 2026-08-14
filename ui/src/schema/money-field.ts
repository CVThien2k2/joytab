import { z } from "zod"

/**
 * Input: Message hiển thị khi ô số bị bỏ trống hoặc gõ chữ.
 * Output: Schema số nguyên dùng cho ô `<input type="number">`.
 *
 * Cố tình KHÔNG dùng `z.coerce.number()`: nó có input type `unknown`, khiến react-hook-form
 * suy ra `field.value: unknown` và mọi `<Input {...field} />` đều đỏ. Ở đây input và output
 * cùng là `number`, còn việc đổi chuỗi → số do `event.target.valueAsNumber` lo — ô rỗng cho
 * ra NaN và rơi đúng vào message này.
 */
export function intField(message: string) {
  return z
    .number({ error: message })
    .refine((value) => Number.isInteger(value), { message })
}
