import { z } from "zod"
import { meResponseSchema } from "@/schema/auth"

export type CurrentUser = z.infer<typeof meResponseSchema>["data"]
