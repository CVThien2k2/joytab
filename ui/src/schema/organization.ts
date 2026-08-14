import { z } from "zod"
import { envelope } from "@/schema/envelope"
import {
  inviteTypeSchema,
  memberRoleSchema,
  memberStatusSchema,
} from "@/schema/enums"

export const organizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  myRole: memberRoleSchema,
  memberCount: z.number(),
  createdAt: z.coerce.date(),
})

export const memberSchema = z.object({
  userId: z.string(),
  fullName: z.string().nullable(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: memberRoleSchema,
  status: memberStatusSchema,
  joinedAt: z.coerce.date(),
})

export const inviteSchema = z.object({
  id: z.string(),
  type: inviteTypeSchema,
  expiresAt: z.coerce.date().nullable(),
  maxUses: z.number().nullable(),
  usedCount: z.number(),
  revokedAt: z.coerce.date().nullable(),
  usable: z.boolean(),
  createdAt: z.coerce.date(),
})

/** Chỉ response lúc TẠO mới có `token`/`url` — DB không giữ token thô nên không lấy lại được. */
export const createdInviteSchema = inviteSchema.extend({
  token: z.string(),
  url: z.string(),
})

export const invitePreviewSchema = z.object({
  organization: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    memberCount: z.number(),
  }),
  usable: z.boolean(),
})

export const acceptInviteSchema = z.object({
  organizationId: z.string(),
  alreadyMember: z.boolean(),
})

export const organizationResponseSchema = envelope(organizationSchema)
export const organizationListResponseSchema = envelope(z.array(organizationSchema))
export const memberListResponseSchema = envelope(z.array(memberSchema))
export const memberResponseSchema = envelope(memberSchema)
export const inviteResponseSchema = envelope(inviteSchema)
export const inviteListResponseSchema = envelope(z.array(inviteSchema))
export const createdInviteResponseSchema = envelope(createdInviteSchema)
export const invitePreviewResponseSchema = envelope(invitePreviewSchema)
export const acceptInviteResponseSchema = envelope(acceptInviteSchema)
export const removeMemberResponseSchema = envelope(z.object({ userId: z.string() }))

// ===== Form input =====

export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên nhóm").max(255, "Tên nhóm quá dài"),
})

export const inviteFormSchema = z.object({
  /** Chuỗi rỗng = không giới hạn; giữ dạng string để <Input> không phải xử lý NaN. */
  expiresInDays: z.string(),
  maxUses: z.string(),
})
