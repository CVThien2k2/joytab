"use client"

import { Check, Copy, Link2, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCreateInvite, useInvites, useRevokeInvite } from "@/hooks/use-invites"
import { formatDateTime } from "@/lib/format"

/**
 * Input: Chuỗi người dùng gõ vào ô số.
 * Output: Số nguyên dương, hoặc undefined khi để trống — undefined nghĩa là "không giới hạn".
 */
function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const parsed = Number(trimmed)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Input: orgId.
 * Output: Panel tạo/thu hồi link mời.
 *
 * Link vừa tạo được giữ trong state của component: token thô chỉ có trong response lúc tạo,
 * tải lại trang là mất vĩnh viễn — nên phải hiện ra ngay và cho copy.
 */
export function InvitePanel({ orgId }: { orgId: string }) {
  const { data: invites, isPending } = useInvites(orgId)
  const createInvite = useCreateInvite(orgId)
  const revokeInvite = useRevokeInvite(orgId)

  const [expiresInDays, setExpiresInDays] = useState("7")
  const [maxUses, setMaxUses] = useState("")
  const [freshUrl, setFreshUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    toast.success("Đã copy link mời")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link mời</CardTitle>
        <CardDescription>
          Gửi link cho người muốn tham gia. Link chỉ hiện đúng một lần sau khi tạo.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="expiresInDays">Hết hạn sau (ngày)</Label>
            <Input
              id="expiresInDays"
              inputMode="numeric"
              className="w-40"
              placeholder="Không hết hạn"
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="maxUses">Số lượt tối đa</Label>
            <Input
              id="maxUses"
              inputMode="numeric"
              className="w-40"
              placeholder="Không giới hạn"
              value={maxUses}
              onChange={(event) => setMaxUses(event.target.value)}
            />
          </div>
          <Button
            disabled={createInvite.isPending}
            onClick={() =>
              createInvite.mutate(
                {
                  expiresInDays: parseOptionalNumber(expiresInDays),
                  maxUses: parseOptionalNumber(maxUses),
                },
                { onSuccess: (invite) => setFreshUrl(invite.url) },
              )
            }
          >
            <Link2 className="size-4" />
            Tạo link mời
          </Button>
        </div>

        {freshUrl ? (
          <div className="bg-muted flex items-center gap-2 rounded-lg p-3">
            <code className="flex-1 truncate text-xs">{freshUrl}</code>
            <Button size="sm" variant="secondary" onClick={() => handleCopy(freshUrl)}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              Copy
            </Button>
          </div>
        ) : null}

        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : invites && invites.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tạo lúc</TableHead>
                <TableHead>Hết hạn</TableHead>
                <TableHead>Lượt dùng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => (
                <TableRow key={invite.id}>
                  <TableCell>{formatDateTime(invite.createdAt)}</TableCell>
                  <TableCell>
                    {invite.expiresAt ? formatDateTime(invite.expiresAt) : "Không hết hạn"}
                  </TableCell>
                  <TableCell>
                    {invite.usedCount}
                    {invite.maxUses === null ? "" : ` / ${invite.maxUses}`}
                  </TableCell>
                  <TableCell>
                    <Badge variant={invite.usable ? "default" : "secondary"}>
                      {invite.usable ? "Còn dùng được" : "Hết hiệu lực"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {invite.usable ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Thu hồi link"
                        disabled={revokeInvite.isPending}
                        onClick={() => revokeInvite.mutate(invite.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">Chưa có link mời nào.</p>
        )}
      </CardContent>
    </Card>
  )
}
