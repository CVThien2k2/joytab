import { z } from "zod"
import {
  bankAccountSchema,
  createOrganizationFormSchema,
  editOrganizationFormSchema,
  joinOrganizationFormSchema,
  organizationMemberSchema,
  paginationSchema,
  organizationOverviewSchema,
  organizationPreviewSchema,
  organizationSchema,
} from "@/schema/organization"

export type Organization = z.infer<typeof organizationSchema>
export type OrganizationRole = Organization["role"]

export type OrganizationPreview = z.infer<typeof organizationPreviewSchema>

export type OrganizationOverview = z.infer<typeof organizationOverviewSchema>

export type OrganizationMember = z.infer<typeof organizationMemberSchema>

export type Pagination = z.infer<typeof paginationSchema>

/** Tài khoản nhận tiền đã gắn tên ngân hàng, BE tra sẵn. */
export type BankAccount = z.infer<typeof bankAccountSchema>

/**
 * Ô hệ số và ô số tài khoản đều nhận chuỗi rồi mới chuẩn hoá, nên input khác output — cả hai
 * form đều phải khai riêng hai kiểu này.
 */
export type CreateOrganizationFormValues = z.input<typeof createOrganizationFormSchema>
export type CreateOrganizationPayload = z.infer<typeof createOrganizationFormSchema>

export type EditOrganizationFormValues = z.input<typeof editOrganizationFormSchema>
export type EditOrganizationPayload = z.infer<typeof editOrganizationFormSchema>

/**
 * `joinCode` vào là chuỗi user gõ, ra là chuỗi đã chuẩn hoá — nên z.input khác z.output và
 * form phải dùng riêng hai kiểu này (giống cách onboarding xử lý `age`).
 */
export type JoinOrganizationFormValues = z.input<typeof joinOrganizationFormSchema>
export type JoinOrganizationPayload = z.infer<typeof joinOrganizationFormSchema>
