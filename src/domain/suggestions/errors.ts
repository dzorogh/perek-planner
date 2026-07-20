import { SUGGESTIONS_RU } from "@/domain/suggestions/constants";

export type SuggestionFailReason =
  | "no_key"
  | "openrouter"
  | "zero_eligible"
  | "parse"
  | "assign"
  | "query";

export class SuggestionError extends Error {
  readonly code = "SUGGESTION_ERROR" as const;

  constructor(
    public readonly reason: SuggestionFailReason,
    message: string,
  ) {
    super(message);
    this.name = "SuggestionError";
  }
}

export const SUGGESTION_FAIL_RU: Record<SuggestionFailReason, string> = {
  no_key: SUGGESTIONS_RU.noKey,
  openrouter: SUGGESTIONS_RU.openRouterFail,
  zero_eligible: SUGGESTIONS_RU.zeroEligible,
  parse: SUGGESTIONS_RU.parseFail,
  assign: SUGGESTIONS_RU.assignFail,
  query: "Не удалось подготовить кандидатов для меню. Попробуйте снова.",
};
