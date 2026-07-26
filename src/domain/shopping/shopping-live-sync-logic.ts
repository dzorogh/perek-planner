/** Pure helpers for shopping-list Realtime refresh decisions (no I/O). */

/** Skip disruptive refresh while a local cart mutation is in flight. */
export function shouldApplyRemoteShoppingRefresh(isPending: boolean): boolean {
  return !isPending;
}
