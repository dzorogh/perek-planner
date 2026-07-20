"use client";

import { DAY_OPTION_LABELS } from "@/domain/menu/constants";
import { cn } from "@/lib/utils";

type DayLengthPickerProps = {
  value: number;
  onChange: (dayCount: number) => void;
  disabled?: boolean;
};

export function DayLengthPicker({
  value,
  onChange,
  disabled = false,
}: DayLengthPickerProps) {
  return (
    <div
      data-component="day-length-picker"
      className="mb-0 flex gap-1 rounded-md bg-background p-1"
      role="radiogroup"
      aria-label="Длина меню"
      aria-disabled={disabled || undefined}
    >
      {DAY_OPTION_LABELS.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.value} ${option.label}`}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-sm px-1.5 py-2 text-center text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-surface font-semibold text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            {option.value}&nbsp;{option.label}
          </button>
        );
      })}
    </div>
  );
}
