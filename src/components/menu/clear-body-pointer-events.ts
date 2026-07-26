/**
 * Radix DropdownMenu (modal) sets `pointer-events: none` on `body`.
 * Opening a Dialog from a menu item — or remounting while the menu is still
 * open — can leave that lock stuck until a full page refresh.
 */
export function clearBodyPointerEvents(): void {
  document.body.style.removeProperty("pointer-events");
}
