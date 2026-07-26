import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getOpenRouterModel } from "@/lib/openrouter/client";
import { isAuthSessionMissingError } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Local shell inspection only — never enable in Dokploy / production.
  const productionLike =
    process.env.NODE_ENV === "production" ||
    process.env.KEPLO_ENV === "production";
  const bypassAuth =
    process.env.KEPLO_DEV_BYPASS_AUTH === "true" && !productionLike;

  let account = "не вошли";

  if (bypassAuth) {
    account = "обход авторизации";
  } else {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    // AuthSessionMissingError = signed out. Other errors may be transient —
    // do not bounce a possibly-valid session to login.
    if (!user && (!error || isAuthSessionMissingError(error))) {
      redirect("/auth/login");
    }
    account = user?.email?.trim() || "без email";
  }

  return (
    <AppShell model={getOpenRouterModel()} account={account}>
      {children}
    </AppShell>
  );
}
