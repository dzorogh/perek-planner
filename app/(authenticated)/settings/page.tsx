import { LogoutButton } from "@/components/logout-button";
import { TastePreferencesPanel } from "@/components/settings/taste-preferences-panel";
import { loadTastePreferences } from "@/domain/settings/taste-preferences";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const preferences =
    user != null
      ? ((await loadTastePreferences(supabase, user.id)) ?? [])
      : [];

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="page-title">Настройки</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Пожелания к меню и выход из сессии.
        </p>
      </div>

      <TastePreferencesPanel items={preferences} />

      <div className="rounded-lg border border-border bg-surface px-5 py-5">
        <LogoutButton />
      </div>
    </div>
  );
}
