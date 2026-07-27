/** Pure helpers for live menu Realtime refresh decisions (no I/O). */

export function shouldApplyRemoteMenuRefresh(isAnyBusy: boolean): boolean {
  return !isAnyBusy;
}

/**
 * Whether a menu_dishes change belongs to the open menu.
 * Missing menu_slot_id → ignore (avoid cross-menu false positives).
 */
export function menuSlotDishEventMatchesMenu(
  menuSlotId: string | null | undefined,
  slotIds: ReadonlySet<string>,
): boolean {
  if (typeof menuSlotId !== "string" || menuSlotId.length === 0) return false;
  return slotIds.has(menuSlotId);
}

/** Broadcast event so other tabs show the same slot busy overlay. */
export type MenuBusyBroadcastPayload = {
  senderId: string;
  kind: "recipe" | "snack";
  key: string;
  /** Russian status label, or null to clear. */
  label: string | null;
};

export const MENU_BUSY_BROADCAST_EVENT = "menu-busy";

/** Ignore own echo even if channel config fails to suppress self. */
export function shouldApplyRemoteBusy(
  senderId: string | null | undefined,
  selfId: string,
): boolean {
  if (typeof senderId !== "string" || senderId.length === 0) return false;
  return senderId !== selfId;
}

export function parseMenuBusyBroadcastPayload(
  raw: unknown,
): MenuBusyBroadcastPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const senderId = typeof o.senderId === "string" ? o.senderId.trim() : "";
  const kind = o.kind === "recipe" || o.kind === "snack" ? o.kind : null;
  const key = typeof o.key === "string" ? o.key.trim() : "";
  if (!senderId || !kind || !key) return null;
  if (o.label === null) {
    return { senderId, kind, key, label: null };
  }
  if (typeof o.label !== "string") return null;
  const label = o.label.trim();
  if (!label) return null;
  return { senderId, kind, key, label };
}
