import { z } from "zod"
import {
  createOrganizationFormSchema,
  editOrganizationFormSchema,
  joinOrganizationFormSchema,
  organizationMemberSchema,
  paginationSchema,
  organizationPreviewSchema,
  organizationSchema,
} from "@/schema/organization"

export type Organization = z.infer<typeof organizationSchema>
export type OrganizationRole = Organization["role"]

export type OrganizationPreview = z.infer<typeof organizationPreviewSchema>

export type OrganizationMember = z.infer<typeof organizationMemberSchema>

export type Pagination = z.infer<typeof paginationSchema>

export type CreateOrganizationPayload = z.infer<typeof createOrganizationFormSchema>

/** Ô hệ số nhập chuỗi rồi mới ép số, nên input khác output — xem chú thích ở schema. */
export type EditOrganizationFormValues = z.input<typeof editOrganizationFormSchema>
export type EditOrganizationPayload = z.infer<typeof editOrganizationFormSchema>

/**
 * `joinCode` vào là chuỗi user gõ, ra là chuỗi đã chuẩn hoá — nên z.input khác z.output và
 * form phải dùng riêng hai kiểu này (giống cách onboarding xử lý `age`).
 */
export type JoinOrganizationFormValues = z.input<typeof joinOrganizationFormSchema>
export type JoinOrganizationPayload = z.infer<typeof joinOrganizationFormSchema>
