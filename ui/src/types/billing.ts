import { z } from "zod"
import {
  debtLineSchema,
  memberDebtSchema,
  myDebtsSchema,
  paymentFormSchema,
  paymentSchema,
} from "@/schema/billing"
import {
  debtStatusSchema,
  paymentMethodSchema,
  paymentStatusSchema,
} from "@/schema/enums"

export type DebtLine = z.infer<typeof debtLineSchema>
export type MyDebts = z.infer<typeof myDebtsSchema>
export type MemberDebt = z.infer<typeof memberDebtSchema>
export type Payment = z.infer<typeof paymentSchema>
export type DebtStatus = z.infer<typeof debtStatusSchema>
export type PaymentMethod = z.infer<typeof paymentMethodSchema>
export type PaymentStatus = z.infer<typeof paymentStatusSchema>
export type PaymentFormValues = z.infer<typeof paymentFormSchema>
