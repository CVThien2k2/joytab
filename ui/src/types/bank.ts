import { z } from "zod"
import { bankAccountFormSchema, bankSchema } from "@/schema/bank"

export type Bank = z.infer<typeof bankSchema>

/** Số tài khoản được chuẩn hoá lúc parse nên input khác output — form phải dùng riêng hai kiểu. */
export type BankAccountFormValues = z.input<typeof bankAccountFormSchema>
export type BankAccountPayload = z.infer<typeof bankAccountFormSchema>
