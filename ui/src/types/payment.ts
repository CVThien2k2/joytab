import { z } from "zod"
import {
  organizationChargeGroupSchema,
  paymentSchema,
  rejectPaymentFormSchema,
  userChargeSchema,
} from "@/schema/payment"

export type UserCharge = z.infer<typeof userChargeSchema>
export type OrganizationChargeGroup = z.infer<typeof organizationChargeGroupSchema>
export type Payment = z.infer<typeof paymentSchema>
export type PaymentStatus = Payment["status"]
export type RejectPaymentFormValues = z.infer<typeof rejectPaymentFormSchema>
