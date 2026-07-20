/** Strip leading "1." / "1)" / "1:" markers from a step line. */
export function stripStepNumber(step: string): string {
  return step.replace(/^\d{1,2}[.)]:?\s*/, "").trim();
}

/**
 * Split recipe body into cooking steps.
 * Prefers newline-separated lines; falls back to "1. … 2. …" in one paragraph.
 */
export function splitRecipeSteps(bodyText: string): string[] {
  const trimmed = bodyText.trim();
  if (!trimmed) return [];

  const byLine = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (byLine.length > 1) {
    return byLine.map(stripStepNumber).filter(Boolean);
  }

  const single = byLine[0] ?? trimmed;
  const numbered = single
    .split(/(?=(?:^|\s)\d{1,2}[.)]\s+)/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(stripStepNumber)
    .filter(Boolean);

  if (numbered.length > 1) return numbered;
  return [stripStepNumber(single) || single];
}

/** Normalize body_text to numbered lines separated by newlines. */
export function normalizeRecipeBodyText(bodyText: string): string {
  const steps = splitRecipeSteps(bodyText);
  if (steps.length === 0) return bodyText.trim();
  return steps.map((step, i) => `${i + 1}. ${step}`).join("\n");
}

/** Russian unit word for «порция» (without the number). */
export function portionUnitWord(count: number): string {
  const n = Math.trunc(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "порция";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return "порции";
  }
  return "порций";
}

/** Russian plural for «порция». */
export function formatPortionsLabel(count: number): string {
  const n = Math.trunc(count);
  return `${n} ${portionUnitWord(n)}`;
}

/** Russian unit word for «день» (without the number). */
export function dayUnitWord(count: number): string {
  const n = Math.trunc(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return "дня";
  }
  return "дней";
}

/** Russian plural for «день». */
export function formatDaysLabel(count: number): string {
  const n = Math.trunc(count);
  return `${n} ${dayUnitWord(n)}`;
}

/** Russian plural for «человек» after a number. */
export function formatPeopleLabel(count: number): string {
  const n = Math.trunc(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} человек`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} человека`;
  }
  return `${n} человек`;
}

/**
 * Subtitle under recipe title: total portions + people × days when they explain the total.
 */
export function formatRecipeYieldLabel(scale: {
  totalServings: number;
  peoplePerMeal: number;
  dayCount: number;
}): string {
  const total = formatPortionsLabel(scale.totalServings);
  const people = formatPeopleLabel(scale.peoplePerMeal);
  const days = formatDaysLabel(scale.dayCount);
  if (
    scale.dayCount > 1 &&
    scale.peoplePerMeal * scale.dayCount === scale.totalServings
  ) {
    return `На ${total} · ${people} × ${days}`;
  }
  if (scale.dayCount > 1) {
    return `На ${total} · ${people}, ${days} в меню`;
  }
  return `На ${total} · ${people}`;
}
