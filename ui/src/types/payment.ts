import { z } from "zod"
import { organizationChargeGroupSchema, paymentSchema, userChargeSchema } from "@/schema/payment"

export type UserCharge = z.infer<typeof userChargeSchema>
export type OrganizationChargeGroup = z.infer<typeof organizationChargeGroupSchema>
export type Payment = z.infer<typeof paymentSchema>
