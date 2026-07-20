type SlotGeneratingOverlayProps = {
  /** Calm Russian status, e.g. «Заменяем…» / «Подбираем…». */
  label: string;
};

/**
 * Soft Workshop generating state for a slot-cell / snack-slot.
 * Mirrors dish-line padding/typography; parent must be `relative`.
 */
export function SlotGeneratingOverlay({ label }: SlotGeneratingOverlayProps) {
  return (
    <div
      data-component="slot-generating"
      className="absolute inset-0 z-[5] rounded-md bg-empty-slot px-3.5 py-3 pr-8"
      aria-busy="true"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-slot-label">{label}</p>
      <div
        className="slot-generating-shimmer mt-1.5 h-3 w-24 rounded-sm bg-border"
        aria-hidden
      />
    </div>
  );
}
