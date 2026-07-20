"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/update-password`,
        },
      );
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось отправить письмо. Попробуйте снова.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      data-component="forgot-password-form"
      {...props}
    >
      {success ? (
        <Card className="border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="page-title">Проверьте почту</CardTitle>
            <CardDescription className="text-muted-foreground">
              Если аккаунт с таким адресом есть, придёт ссылка для сброса
              пароля.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/auth/login"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              К входу
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border bg-surface shadow-none">
          <CardHeader>
            <CardTitle className="page-title">Сброс пароля</CardTitle>
            <CardDescription className="text-muted-foreground">
              Укажите эл. почту — пришлём ссылку для нового пароля.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Эл. почта</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="логин@почта.ru"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full rounded-sm"
                disabled={isLoading}
              >
                {isLoading ? "Отправляем…" : "Отправить ссылку"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Вспомнили пароль?{" "}
                <Link
                  href="/auth/login"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Войти
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
