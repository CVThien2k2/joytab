import { z } from "zod"
import {
  createOrganizationFormSchema,
  joinOrganizationFormSchema,
  organizationSchema,
} from "@/schema/organization"

export type Organization = z.infer<typeof organizationSchema>
export type OrganizationRole = Organization["role"]

export type CreateOrganizationPayload = z.infer<typeof createOrganizationFormSchema>

/**
 * `joinCode` vào là chuỗi user gõ, ra là chuỗi đã chuẩn hoá — nên z.input khác z.output và
 * form phải dùng riêng hai kiểu này (giống cách onboarding xử lý `age`).
 */
export type JoinOrganizationFormValues = z.input<typeof joinOrganizationFormSchema>
export type JoinOrganizationPayload = z.infer<typeof joinOrganizationFormSchema>
