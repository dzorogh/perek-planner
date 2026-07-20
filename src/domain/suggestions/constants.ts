/** Recipes not assigned for this many days are long-idle reintroduction candidates. */
export const LONG_IDLE_DAYS = 14;

/**
 * Recipes that appeared in this many most-recent menus are passed to AI
 * as “do not repeat” context (and marked recentlyUsed for ranking).
 */
export const RECENT_MENUS_COOLDOWN = 3;

/** Snack labels from this many most-recent menus are avoided on the next generation. */
export const RECENT_SNACK_MENUS_COOLDOWN = 4;

export type RecipeRatingValue = "dislike" | "medium" | "like";

/** Higher = prefer when ranking long-idle / general candidates. */
export const RATING_WEIGHT: Record<RecipeRatingValue | "none", number> = {
  like: 3,
  medium: 2,
  none: 1,
  dislike: 0,
};

export const SUGGESTIONS_RU = {
  noKey: "AI-генерация не настроена. Добавьте OPENROUTER_API_KEY на сервере.",
  openRouterFail:
    "Не удалось получить предложения меню. Попробуйте ещё раз чуть позже.",
  zeroEligible:
    "Нет доступных блюд для этого меню — попробуйте другую длину или сгенерируйте снова.",
  parseFail: "AI вернул некорректный план. Попробуйте ещё раз.",
  persistFail: "Не удалось сохранить новые рецепты. Попробуйте ещё раз.",
  assignFail: "Не удалось назначить блюда в слоты. Попробуйте ещё раз.",
  tasteNotesFail:
    "Не удалось загрузить запреты и пожелания. Попробуйте ещё раз.",
  rollbackOk: "Генерация не удалась — меню не сохранено.",
  rollbackFail:
    "Генерация не удалась, и не удалось удалить черновик меню. Проверьте историю меню.",
} as const;
