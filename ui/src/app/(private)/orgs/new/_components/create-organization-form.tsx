"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useCreateOrganization } from "@/hooks/use-organizations"
import { organizationFormSchema } from "@/schema/organization"

type FormValues = z.infer<typeof organizationFormSchema>

/**
 * Input: Không nhận props.
 * Output: Form tạo nhóm. Người tạo tự động thành quản trị viên, hook tự điều hướng vào nhóm.
 */
export function CreateOrganizationForm() {
  const createOrganization = useCreateOrganization()
  const form = useForm<FormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: "" },
  })

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/">
          <ArrowLeft className="size-4" />
          Về danh sách nhóm
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Tạo nhóm mới</CardTitle>
          <CardDescription>
            Bạn sẽ là quản trị viên của nhóm và có thể mời thêm người sau.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) =>
                createOrganization.mutate(values),
              )}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tên nhóm</FormLabel>
                    <FormControl>
                      <Input placeholder="Cầu lông tối thứ 5" {...field} />
                    </FormControl>
                    <FormDescription>
                      Đặt tên dễ nhận ra khi bạn tham gia nhiều nhóm.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={createOrganization.isPending}
              >
                {createOrganization.isPending ? "Đang tạo…" : "Tạo nhóm"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
