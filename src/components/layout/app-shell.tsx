import { AppHeader } from "@/components/layout/app-header";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1180px]">
        <main className="px-7 py-10 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
