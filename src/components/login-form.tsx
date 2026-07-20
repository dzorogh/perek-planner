"use client";

import { useRouter } from "next/navigation";
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

function mapSignInError(error: unknown): string {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (
    message.includes("invalid login credentials") ||
    message.includes("invalid_credentials")
  ) {
    return "Неверный логин или пароль.";
  }
  if (message.includes("email not confirmed")) {
    return "Подтвердите адрес электронной почты, затем войдите снова.";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "Слишком много попыток. Подождите немного и попробуйте снова.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Нет связи с сервером входа. Проверьте сеть и попробуйте снова.";
  }

  return "Не удалось войти. Проверьте данные и попробуйте снова.";
}

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setError(mapSignInError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="border-border bg-surface shadow-none">
        <CardHeader>
          <CardTitle className="page-title">Вход</CardTitle>
          <CardDescription className="text-muted-foreground">
            Войдите, чтобы открыть рабочее пространство планирования меню.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="grid gap-6">
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
            <div className="grid gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full rounded-sm" disabled={isLoading}>
              {isLoading ? "Входим…" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
