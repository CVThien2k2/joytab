import { z } from "zod"
import { accountSchema, deviceSchema, meResponseSchema } from "@/schema/auth"

export type DeviceAccount = z.infer<typeof accountSchema>
export type DeviceSession = z.infer<typeof deviceSchema>
export type CurrentUser = z.infer<typeof meResponseSchema>["data"]
