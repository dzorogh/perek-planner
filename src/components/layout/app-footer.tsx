type AppFooterProps = {
  model: string;
  account: string;
};

export function AppFooter({ model, account }: AppFooterProps) {
  return (
    <footer
      className="border-t border-border bg-surface"
      data-component="app-footer"
    >
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-3 gap-y-1 px-7 py-3 text-xs text-muted-foreground xl:px-10">
        <span>
          Модель: <span className="font-mono text-foreground/80">{model}</span>
        </span>
        <span aria-hidden="true" className="text-border">
          ·
        </span>
        <span>
          Аккаунт:{" "}
          <span className="font-mono text-foreground/80">{account}</span>
        </span>
      </div>
    </footer>
  );
}
