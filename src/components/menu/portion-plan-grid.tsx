"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { MEAL_LABELS_RU } from "@/domain/menu/constants";
import type { MenuSlotView } from "@/domain/menu/load-menu";
import {
  updateSlotServingsAction,
  type PortionActionState,
} from "@/domain/menu/portion-actions";

type PortionPlanGridProps = {
  menuId: string;
  dayCount: number;
  slots: MenuSlotView[];
};

function ServingsCell({
  menuId,
  slot,
}: {
  menuId: string;
  slot: MenuSlotView;
}) {
  const [state, formAction, pending] = useActionState<
    PortionActionState,
    FormData
  >(updateSlotServingsAction, null);

  return (
    <div
      data-component="portion-slot"
      className="rounded-lg bg-surface px-3 py-2 ring-1 ring-border"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
        {MEAL_LABELS_RU[slot.meal]}
      </p>
      <p className="mt-0.5 text-sm text-foreground">
        {slot.recipeName ? (
          <>
            {slot.recipeName}
            {slot.companionRecipeName ? (
              <span className="text-muted-foreground">
                {" · "}
                {slot.companionRecipeName}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-slot-label">Пустой слот</span>
        )}
      </p>
      <form action={formAction} className="mt-2 flex items-center gap-2">
        <input type="hidden" name="menuId" value={menuId} />
        <input type="hidden" name="slotId" value={slot.id} />
        <label className="text-xs text-muted-foreground">Порций</label>
        <Input
          type="number"
          name="servings"
          min={1}
          max={20}
          defaultValue={slot.servings}
          disabled={pending}
          className="h-8 w-16 rounded-sm"
          onBlur={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </form>
      {state && !state.ok ? (
        <p className="mt-1 text-xs text-warning-fg" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function PortionPlanGrid({
  menuId,
  dayCount,
  slots,
}: PortionPlanGridProps) {
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  return (
    <div
      data-component="portion-plan-grid"
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
    >
      {days.map((dayIndex) => {
        const daySlots = slots.filter((s) => s.dayIndex === dayIndex);
        return (
          <section
            key={dayIndex}
            className="rounded-lg border border-border bg-surface"
          >
            <header className="rounded-t-lg border-b border-border bg-background px-4 py-3">
              <h2 className="text-sm font-semibold text-accent">
                День {dayIndex}
              </h2>
            </header>
            <div className="flex flex-col gap-2 p-3">
              {daySlots.map((slot) => (
                <ServingsCell key={slot.id} menuId={menuId} slot={slot} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
