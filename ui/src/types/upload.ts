import { z } from "zod"
import { presignedPostSchema, uploadFolderSchema } from "@/schema/upload"

export type UploadFolder = z.infer<typeof uploadFolderSchema>

export type PresignedPost = z.infer<typeof presignedPostSchema>
