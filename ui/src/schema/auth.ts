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

export const deviceSchema = z.object({
  sessionId: z.string(),
  deviceId: z.string(),
  deviceName: z.string().nullable(),
  platform: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
})

export const devicesResponseSchema = envelope(z.object({ devices: z.array(deviceSchema) }))
export const meResponseSchema = envelope(z.object({ userId: z.string(), user: userSchema }))
