/** Public suggestions API (Story 2.3 — AI generate buyable Menu). */

export { buildCandidates } from "@/domain/suggestions/candidates";
export {
  LONG_IDLE_DAYS,
  RATING_WEIGHT,
  RECENT_MENUS_COOLDOWN,
} from "@/domain/suggestions/constants";
export {
  SUGGESTION_FAIL_RU,
  SuggestionError,
} from "@/domain/suggestions/errors";
export {
  generateBuyableMenuForUser,
  mergeWithDeterministicFill,
} from "@/domain/suggestions/generate-menu";
export {
  clearCompanionForSlot,
  refuseAndReplaceRecipeAcrossMenu,
  resuggestRecipeAcrossMenu,
  resuggestSlotForUser,
} from "@/domain/suggestions/resuggest-slot";
export { isLongIdle } from "@/domain/suggestions/history";
export {
  deterministicAssignments,
  parseAssignmentsJson,
} from "@/domain/suggestions/openrouter-generate";
export {
  normalizePlateAssignments,
  pickCompanionCandidate,
} from "@/domain/suggestions/plate-complete";
export {
  preferFreshCandidates,
  preferInventedCandidates,
  rankCandidates,
  ratingWeight,
} from "@/domain/suggestions/rank";
export { isHardSuppressed } from "@/domain/suggestions/suppress";
export {
  namesEqual,
  normalizeDishName,
  uniqueExactNames,
} from "@/domain/suggestions/dish-similarity";
export {
  isBreakfastMeal,
  isLunchDinnerMeal,
  isSuitableAsBreakfastMain,
  looksLikeBreakfastDish,
  looksLikeCompanionOnly,
  looksLikeHeavyAnimalProteinDish,
  looksLikeLunchDinnerOnlyMain,
  looksLikeNoCookSnack,
  looksLikeProteinDish,
  mainsForMeal,
  mealsIncludeLunchOrDinner,
  stripHardcodedPairing,
} from "@/domain/suggestions/meal-fit";
export {
  batchSlotRatio,
  enforceDayVariety,
  ensureHeavyAnimalOnLunchDinner,
  hasDuplicateDayMenus,
  hasSameDayMainReuse,
  isMenuUniformAcrossDays,
  MIN_BATCH_SLOT_RATIO,
} from "@/domain/suggestions/variety";
