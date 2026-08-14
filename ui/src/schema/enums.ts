import { z } from "zod"

/** Khớp 1-1 với Prisma enum ở BE. Sai một chữ là parse hỏng ngay lúc dev, không lọt ra production. */
export const memberRoleSchema = z.enum(["ADMIN", "MEMBER"])
export const memberStatusSchema = z.enum(["ACTIVE", "LEFT"])
export const inviteTypeSchema = z.enum(["EMAIL", "LINK"])
export const eventStatusSchema = z.enum(["OPEN", "COMPLETED", "CANCELLED"])
export const attendanceStatusSchema = z.enum(["GOING", "NOT_GOING"])
export const paymentMethodSchema = z.enum(["CASH", "BANK_TRANSFER"])
export const paymentStatusSchema = z.enum(["PENDING", "CONFIRMED", "REJECTED"])

/** Trạng thái nợ do BE tính lúc đọc, không có cột nào lưu. */
export const debtStatusSchema = z.enum(["UNPAID", "PARTIAL", "PAID"])
