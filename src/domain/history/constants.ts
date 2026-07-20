export type RatingValue = "like" | "medium" | "dislike";

/** History UI only exposes like / dislike. */
export type HistoryRatingValue = "like" | "dislike";

export const RATING_VALUE_LABELS_RU: Record<RatingValue, string> = {
  like: "Нравится",
  medium: "Нормально",
  dislike: "Не нравится",
};

export const MIN_FEEDBACK_COMMENT_LENGTH = 3;
export const MAX_FEEDBACK_COMMENT_LENGTH = 500;

export function normalizeFeedbackComment(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidFeedbackComment(raw: string): boolean {
  const comment = normalizeFeedbackComment(raw);
  return (
    comment.length >= MIN_FEEDBACK_COMMENT_LENGTH &&
    comment.length <= MAX_FEEDBACK_COMMENT_LENGTH
  );
}
