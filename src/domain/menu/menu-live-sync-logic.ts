/** Pure helpers for live menu Realtime refresh decisions (no I/O). */

export function shouldApplyRemoteMenuRefresh(isAnyBusy: boolean): boolean {
  return !isAnyBusy;
}

/**
 * Whether a menu_slot_dishes change belongs to the open menu.
 * Missing menu_slot_id → ignore (avoid cross-menu false positives).
 */
export function menuSlotDishEventMatchesMenu(
  menuSlotId: string | null | undefined,
  slotIds: ReadonlySet<string>,
): boolean {
  if (typeof menuSlotId !== "string" || menuSlotId.length === 0) return false;
  return slotIds.has(menuSlotId);
}
