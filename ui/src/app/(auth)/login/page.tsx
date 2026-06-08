"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { redirectToGoogleLogin } from "@/lib/google-login";

const loginFormSchema = z.object({
  username: z.string().trim().min(3, "Tên đăng nhập phải có ít nhất 3 ký tự."),
  password: z.string().min(6, "Mật khẩu phải có ít nhất 6 ký tự."),
});

type LoginFormValues = z.infer<typeof loginFormSchema>;

/**
 * Input: Không nhận tham số.
 * Output: Màn hình login bằng username/password local + nút đăng nhập Google.
 */
export default function LoginPage() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  /**
   * Input: Giá trị username/password đã qua validate từ form local.
   * Output: Log payload đăng nhập, chưa gọi API thật.
   */
  const handleLoginSubmit = (values: LoginFormValues) => {
    console.log("login form submit", values);
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center pb-2 text-center">
          <CardTitle className="mt-4">Đăng nhập</CardTitle>
          <CardDescription>Nhập tài khoản Joytab để tiếp tục.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-2">
          <form onSubmit={form.handleSubmit(handleLoginSubmit)}>
            <FieldGroup className="gap-4">
              <Controller
                control={form.control}
                name="username"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Tên đăng nhập</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="text"
                      autoComplete="username"
                      placeholder="Nhập tên đăng nhập"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="password"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>Mật khẩu</FieldLabel>
                    <Input
                      {...field}
                      id={field.name}
                      type="password"
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : null}
                  </Field>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                Đăng nhập
              </Button>
            </FieldGroup>
          </form>

          <FieldSeparator>Đăng nhập bằng phương thức khác</FieldSeparator>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => redirectToGoogleLogin({ selectAccount: true })}
          >
            <Image
              src="/google-icon.svg"
              alt=""
              width={18}
              height={18}
              aria-hidden="true"
            />
            Tiếp tục với Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
