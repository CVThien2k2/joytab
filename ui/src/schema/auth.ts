import { z } from "zod"
import { envelope } from "@/schema/envelope"

export const userSchema = z.object({
  provider: z.literal("google"),
  providerUserId: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
})

export const accountSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  needsRelogin: z.boolean(),
})

export const deviceSchema = z.object({
  sessionId: z.string(),
  deviceId: z.string(),
  deviceName: z.string().nullable(),
  platform: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
})

export const accountsResponseSchema = envelope(z.object({ accounts: z.array(accountSchema) }))
export const devicesResponseSchema = envelope(z.object({ devices: z.array(deviceSchema) }))
export const meResponseSchema = envelope(z.object({ userId: z.string(), user: userSchema }))
export const switchResponseSchema = envelope(z.object({ success: z.boolean(), userId: z.string() }))
