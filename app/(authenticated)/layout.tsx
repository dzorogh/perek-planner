import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Local shell inspection only — never enable in Dokploy / production.
  const bypassAuth =
    process.env.KEPLO_DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production";

  if (!bypassAuth) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    // Transient auth failures: do not bounce a possibly-valid session to login.
    if (!error && !user) {
      redirect("/auth/login");
    }
  }

  return <AppShell>{children}</AppShell>;
}
