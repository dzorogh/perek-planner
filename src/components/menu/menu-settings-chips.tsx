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

const chipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5";
const chipKeyClass =
  "text-[11px] font-semibold uppercase leading-none tracking-wide text-muted-foreground";
const chipValClass = "text-[13px] font-medium leading-none text-accent";

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
      <span className={chipClass}>
        <span className={chipKeyClass}>Дни</span>
        <span className={chipValClass}>{dayCount}</span>
      </span>
      <span className={chipClass}>
        <span className={chipKeyClass}>На приём</span>
        <span className={chipValClass}>{people} чел.</span>
      </span>
      {mealLabels.length > 0 ? (
        <span className={chipClass}>
          <span className={chipKeyClass}>Приёмы</span>
          <span className={chipValClass}>{mealLabels.join(" · ")}</span>
        </span>
      ) : null}
      {tech.length > 0 ? (
        <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-empty-slot py-1.5 pl-3 pr-1.5">
          <span className={chipKeyClass}>Техника</span>
          {tech.map((id) => (
            <span
              key={id}
              className="inline-flex items-center rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-medium leading-none text-foreground"
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
