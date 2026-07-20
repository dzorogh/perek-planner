export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <rect x="7" y="9" width="5" height="14" rx="1.5" className="fill-background" />
      <rect
        x="13.5"
        y="9"
        width="5"
        height="14"
        rx="1.5"
        className="fill-snacks-border"
      />
      <rect x="20" y="9" width="5" height="14" rx="1.5" className="fill-background" />
    </svg>
  );
}
