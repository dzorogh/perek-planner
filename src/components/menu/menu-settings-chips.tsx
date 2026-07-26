import {
  EQUIPMENT_LABELS_RU,
  isEquipmentId,
  type EquipmentId,
} from "@/domain/menu/equipment";
import { MEAL_LABELS_RU, type MealSlot } from "@/domain/menu/constants";

type MenuSettingsChipsProps = {
  dayCount: number;
  people: number;
  meals: readonly MealSlot[];
  equipment: readonly string[];
};

function dayWord(n: number): string {
  if (n === 1) return "день";
  if (n >= 2 && n <= 4) return "дня";
  return "дней";
}

export function MenuSettingsChips({
  dayCount,
  people,
  meals,
  equipment,
}: MenuSettingsChipsProps) {
  const mealLabels = meals
    .map((m) => MEAL_LABELS_RU[m] ?? m)
    .filter(Boolean);
  const tech = equipment.filter(isEquipmentId) as EquipmentId[];

  return (
    <div
      data-component="menu-settings-chips"
      className="mt-3.5 flex flex-wrap gap-2"
      aria-label="Параметры меню (только просмотр)"
    >
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-accent shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Дни
        </span>
        {dayCount}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-accent shadow-sm">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          На приём
        </span>
        {people} чел.
      </span>
      {mealLabels.length > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-accent shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Приёмы
          </span>
          {mealLabels.join(" · ")}
        </span>
      ) : null}
      {tech.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-empty-slot py-1 pl-2.5 pr-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Техника
          </span>
          {tech.map((id) => (
            <span
              key={id}
              className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium text-foreground"
            >
              {EQUIPMENT_LABELS_RU[id]}
            </span>
          ))}
        </span>
      ) : null}
      <span className="sr-only">
        Меню на {dayCount} {dayWord(dayCount)}, параметры нельзя изменить на
        этом экране.
      </span>
    </div>
  );
}
