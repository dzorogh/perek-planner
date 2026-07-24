"use client";

import {
  EQUIPMENT_IDS,
  EQUIPMENT_LABELS_RU,
  listFromSelection,
  type EquipmentId,
  type EquipmentSelection,
} from "@/domain/menu/equipment";
import { cn } from "@/lib/utils";

type EquipmentPickerProps = {
  value: EquipmentSelection;
  onChange: (next: EquipmentSelection) => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export function EquipmentPicker({
  value,
  onChange,
  disabled = false,
  ariaLabel = "Доступная техника",
}: EquipmentPickerProps) {
  const selectedCount = EQUIPMENT_IDS.filter((id) => value[id]).length;

  function toggle(id: EquipmentId, checked: boolean) {
    const next = { ...value, [id]: checked };
    if (listFromSelection(next) === null) return;
    onChange(next);
  }

  return (
    <div
      data-component="equipment-picker"
      className="mb-2 flex flex-wrap gap-2"
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {EQUIPMENT_IDS.map((id) => {
        const checked = value[id];
        const lockedOn = checked && selectedCount === 1;
        return (
          <button
            key={id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            disabled={disabled || lockedOn}
            onClick={() => toggle(id, !checked)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              checked
                ? "border-primary/25 bg-secondary text-primary shadow-sm"
                : "border-transparent bg-background text-muted-foreground hover:text-foreground",
              (disabled || lockedOn) && "cursor-not-allowed opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border text-[10px] leading-none",
                checked
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface",
              )}
            >
              {checked ? "✓" : ""}
            </span>
            {EQUIPMENT_LABELS_RU[id]}
          </button>
        );
      })}
    </div>
  );
}
