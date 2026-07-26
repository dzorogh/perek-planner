"use client";

import { MoreHorizontal } from "lucide-react";
import {
  startTransition,
  useActionState,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { clearBodyPointerEvents } from "@/components/menu/clear-body-pointer-events";
import { useMenuSlotBusy } from "@/components/menu/menu-slot-busy";
import { SlotDishLine } from "@/components/menu/slot-dish-line";
import { SlotGeneratingOverlay } from "@/components/menu/slot-generating-overlay";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MenuSnackView } from "@/domain/menu/load-menu";
import {
  refuseSnackAction,
  resuggestSnackAction,
  suggestSnackForDayAction,
  type SnackActionState,
} from "@/domain/menu/snack-actions";
import { formatSnackLabel } from "@/domain/suggestions/snack-pool";

type SnackSlotCardProps = {
  menuId: string;
  dayIndex: number;
  snack: MenuSnackView | null;
  /** Scale price/KBJU like meal slots (people per meal). */
  servings?: number;
  portionCount?: number;
  sheetLayout?: boolean;
};

function ActionError({ state }: { state: SnackActionState }) {
  if (!state || state.ok) return null;
  return (
    <p className="mt-1 text-xs text-warning-fg" role="alert">
      {state.error}
    </p>
  );
}

function SnackSlotActions({
  snack,
  busy,
  generating,
  generatingLabel,
  suggestPending,
  resuggestPending,
  refusePending,
  sharedBusyLabel,
  suggestState,
  resuggestState,
  refuseState,
  refuseOpen,
  setRefuseOpen,
  onSuggest,
  onResuggest,
  onRefuseSubmit,
  inline = false,
}: {
  snack: MenuSnackView | null;
  busy: boolean;
  generating: boolean;
  generatingLabel: string;
  suggestPending: boolean;
  resuggestPending: boolean;
  refusePending: boolean;
  sharedBusyLabel: string | null;
  suggestState: SnackActionState;
  resuggestState: SnackActionState;
  refuseState: SnackActionState;
  refuseOpen: boolean;
  setRefuseOpen: (open: boolean) => void;
  onSuggest: () => void;
  onResuggest: () => void;
  onRefuseSubmit: (comment: string) => void;
  inline?: boolean;
}): ReactNode {
  const empty = !snack;
  const [menuOpen, setMenuOpen] = useState(false);

  useLayoutEffect(() => {
    if (!busy) return;
    setMenuOpen(false);
    clearBodyPointerEvents();
  }, [busy]);

  function closeMenu() {
    setMenuOpen(false);
    clearBodyPointerEvents();
  }

  function openRefuseDialog() {
    closeMenu();
    requestAnimationFrame(() => {
      clearBodyPointerEvents();
      setRefuseOpen(true);
    });
  }

  const menu = (
    <>
      <div className={inline ? "relative z-10" : "absolute right-2 top-2 z-10"}>
        <DropdownMenu
          open={menuOpen}
          onOpenChange={(open) => {
            setMenuOpen(open);
            if (!open) clearBodyPointerEvents();
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:bg-background hover:text-primary"
              disabled={busy}
              aria-label="Действия со слотом"
              aria-busy={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[13rem] rounded-md border-border"
          >
            {empty ? (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => {
                  closeMenu();
                  onSuggest();
                }}
              >
                {suggestPending ? "Подбираем…" : "Предложить"}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={busy}
                  className="focus:bg-background focus:text-primary"
                  onSelect={() => {
                    closeMenu();
                    onResuggest();
                  }}
                >
                  {resuggestPending || sharedBusyLabel
                    ? "Заменяем…"
                    : "Заменить"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy}
                  className="text-warning-fg focus:bg-background focus:text-warning-fg"
                  onSelect={openRefuseDialog}
                >
                  Не предлагать
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!generating ? (
        <div
          className={
            inline
              ? "relative z-[6] mt-1 max-w-[12rem] space-y-0.5 text-right"
              : "relative z-[6] mt-1 space-y-0.5 pr-10"
          }
        >
          <ActionError state={resuggestState} />
          <ActionError state={suggestState} />
          <ActionError state={refuseState} />
        </div>
      ) : null}

      {snack ? (
        <CommentDialog
          open={refuseOpen}
          onOpenChange={(open) => {
            setRefuseOpen(open);
            if (!open) clearBodyPointerEvents();
          }}
          title="Не предлагать"
          description="Перекус уберём из этого меню и больше не будем предлагать. Напишите почему — генератор учтёт это дальше."
          submitLabel="Убрать и заменить"
          pending={refusePending}
          error={refuseState && !refuseState.ok ? refuseState.error : null}
          onSubmit={(comment) => {
            clearBodyPointerEvents();
            onRefuseSubmit(comment);
          }}
        />
      ) : null}
    </>
  );

  if (inline) {
    return (
      <>
        {generating ? <SlotGeneratingOverlay label={generatingLabel} /> : null}
        <div
          data-component="slot-actions"
          data-target="snack"
          className="relative z-10 flex shrink-0 flex-col items-end"
        >
          {menu}
        </div>
      </>
    );
  }

  return (
    <div data-component="slot-actions" data-target="snack" className="contents">
      {generating ? <SlotGeneratingOverlay label={generatingLabel} /> : null}
      {menu}
    </div>
  );
}

export function SnackSlotCard({
  menuId,
  dayIndex,
  snack,
  servings = 1,
  portionCount,
  sheetLayout = false,
}: SnackSlotCardProps) {
  const { snackBusyLabel, setSnackBusy, setActionBusy } = useMenuSlotBusy();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [resuggestState, resuggestAction, resuggestPending] = useActionState<
    SnackActionState,
    FormData
  >(resuggestSnackAction, null);
  const [suggestState, suggestAction, suggestPending] = useActionState<
    SnackActionState,
    FormData
  >(suggestSnackForDayAction, null);
  const [refuseState, refuseAction, refusePending] = useActionState<
    SnackActionState,
    FormData
  >(refuseSnackAction, null);

  const snackLabel = snack?.label ?? "";
  const acrossMenuPending = resuggestPending || refusePending;
  const sharedBusyLabel = snackLabel ? snackBusyLabel(snackLabel) : null;

  useLayoutEffect(() => {
    if (!snackLabel || !acrossMenuPending) return;
    setSnackBusy(snackLabel, "Заменяем…");
    return () => setSnackBusy(snackLabel, null);
  }, [snackLabel, acrossMenuPending, setSnackBusy]);

  const localBusy = resuggestPending || suggestPending || refusePending;

  useLayoutEffect(() => {
    const key = `snack:${menuId}:${dayIndex}`;
    setActionBusy(key, localBusy);
    return () => setActionBusy(key, false);
  }, [dayIndex, localBusy, menuId, setActionBusy]);

  const busy = localBusy || Boolean(sharedBusyLabel);
  const localGenerating = localBusy;
  const generating = localGenerating || Boolean(sharedBusyLabel);
  const generatingLabel = suggestPending
    ? "Подбираем…"
    : (sharedBusyLabel ?? "Заменяем…");

  function runAction(
    action: (payload: FormData) => void,
    fields: Record<string, string>,
  ) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(fields)) {
      fd.set(key, value);
    }
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div data-component="snack-slot" data-empty={snack ? "false" : "true"}>
      <SlotDishLine
        menuId={menuId}
        slotId={snack?.id ?? `snack-day-${dayIndex}`}
        plateRole="snack"
        plainName={snack ? formatSnackLabel(snack.label) : null}
        plainValue={snack?.value ?? null}
        slotServings={servings}
        portionCount={portionCount}
        sheetLayout={sheetLayout}
        batch={{
          totalServings: servings,
          peoplePerMeal: servings,
          dayCount: 1,
        }}
        emptyLabel="Пусто"
        actions={
          <SnackSlotActions
            snack={snack}
            busy={busy}
            generating={generating}
            generatingLabel={generatingLabel}
            suggestPending={suggestPending}
            resuggestPending={resuggestPending}
            refusePending={refusePending}
            sharedBusyLabel={sharedBusyLabel}
            suggestState={suggestState}
            resuggestState={resuggestState}
            refuseState={refuseState}
            refuseOpen={refuseOpen}
            setRefuseOpen={setRefuseOpen}
            inline={sheetLayout}
            onSuggest={() =>
              runAction(suggestAction, {
                menuId,
                dayIndex: String(dayIndex),
              })
            }
            onResuggest={() =>
              runAction(resuggestAction, {
                menuId,
                snackId: snack!.id,
              })
            }
            onRefuseSubmit={(comment) => {
              setRefuseOpen(false);
              runAction(refuseAction, {
                menuId,
                snackId: snack!.id,
                comment,
              });
            }}
          />
        }
      />
    </div>
  );
}
