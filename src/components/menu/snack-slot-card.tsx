"use client";

import { MoreHorizontal } from "lucide-react";
import {
  startTransition,
  useActionState,
  useLayoutEffect,
  useState,
} from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { useMenuSlotBusy } from "@/components/menu/menu-slot-busy";
import { SlotGeneratingOverlay } from "@/components/menu/slot-generating-overlay";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecipeValueLine } from "@/components/recipes/recipe-value-line";
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
};

function ActionError({ state }: { state: SnackActionState }) {
  if (!state || state.ok) return null;
  return (
    <p className="mt-1 text-xs text-warning-fg" role="alert">
      {state.error}
    </p>
  );
}

export function SnackSlotCard({
  menuId,
  dayIndex,
  snack,
  servings = 1,
}: SnackSlotCardProps) {
  const { snackBusyLabel, setSnackBusy } = useMenuSlotBusy();
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
  const busy = localBusy || Boolean(sharedBusyLabel);
  const localGenerating = localBusy;
  const generating = localGenerating || Boolean(sharedBusyLabel);
  const generatingLabel = suggestPending
    ? "Подбираем…"
    : (sharedBusyLabel ?? "Заменяем…");
  const empty = !snack;

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
    <div
      data-component="snack-slot"
      data-empty={empty ? "true" : "false"}
      className="relative min-h-14 rounded-md bg-empty-slot px-3.5 py-3"
    >
      <span className="sr-only">Перекус</span>
      {generating ? <SlotGeneratingOverlay label={generatingLabel} /> : null}

      <div className="pr-8">
        {empty ? (
          <p className="text-sm text-slot-label">Пустой перекус</p>
        ) : (
          <>
            <p className="text-sm font-semibold text-foreground">
              {formatSnackLabel(snack.label)}
            </p>
            <RecipeValueLine value={snack.value} servings={servings} />
          </>
        )}
      </div>

      <div className="absolute right-2 top-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
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
                onSelect={() =>
                  runAction(suggestAction, {
                    menuId,
                    dayIndex: String(dayIndex),
                  })
                }
              >
                {suggestPending ? "Подбираем…" : "Предложить"}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem
                  disabled={busy}
                  className="focus:bg-background focus:text-primary"
                  onSelect={() =>
                    runAction(resuggestAction, {
                      menuId,
                      snackId: snack.id,
                    })
                  }
                >
                  {resuggestPending || sharedBusyLabel
                    ? "Заменяем…"
                    : "Заменить"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={busy}
                  className="text-warning-fg focus:bg-background focus:text-warning-fg"
                  onSelect={() => setRefuseOpen(true)}
                >
                  Никогда не предлагать
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!generating ? (
        <>
          <ActionError state={resuggestState} />
          <ActionError state={suggestState} />
          <ActionError state={refuseState} />
        </>
      ) : null}

      {snack ? (
        <CommentDialog
          open={refuseOpen}
          onOpenChange={setRefuseOpen}
          title="Никогда не предлагать"
          description="Перекус уберём из этого меню и больше не будем предлагать. Напишите почему — генератор учтёт это дальше."
          submitLabel="Убрать и заменить"
          pending={refusePending}
          error={refuseState && !refuseState.ok ? refuseState.error : null}
          onSubmit={(comment) => {
            setRefuseOpen(false);
            runAction(refuseAction, {
              menuId,
              snackId: snack.id,
              comment,
            });
          }}
        />
      ) : null}
    </div>
  );
}
