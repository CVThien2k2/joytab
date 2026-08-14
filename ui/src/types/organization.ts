import { z } from "zod"
import {
  acceptInviteSchema,
  createdInviteSchema,
  inviteSchema,
  invitePreviewSchema,
  memberSchema,
  organizationSchema,
} from "@/schema/organization"
import { memberRoleSchema } from "@/schema/enums"

export type Organization = z.infer<typeof organizationSchema>
export type Member = z.infer<typeof memberSchema>
export type Invite = z.infer<typeof inviteSchema>
export type CreatedInvite = z.infer<typeof createdInviteSchema>
export type InvitePreview = z.infer<typeof invitePreviewSchema>
export type AcceptInviteResult = z.infer<typeof acceptInviteSchema>
export type MemberRole = z.infer<typeof memberRoleSchema>
