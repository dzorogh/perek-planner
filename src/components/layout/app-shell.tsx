import { AppFooter } from "@/components/layout/app-footer";
import { AppHeader } from "@/components/layout/app-header";

type AppShellProps = {
  children: React.ReactNode;
  model: string;
  account: string;
};

export function AppShell({ children, model, account }: AppShellProps) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1180px] flex-1">
        <main className="px-7 py-10 xl:px-10">{children}</main>
      </div>
      <AppFooter model={model} account={account} />
    </div>
  );
}
