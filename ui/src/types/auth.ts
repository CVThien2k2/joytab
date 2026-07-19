import { z } from "zod"
import { deviceSchema, meResponseSchema } from "@/schema/auth"

export type DeviceSession = z.infer<typeof deviceSchema>
export type CurrentUser = z.infer<typeof meResponseSchema>["data"]
