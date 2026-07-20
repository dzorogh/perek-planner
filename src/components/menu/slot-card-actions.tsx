"use client";

import { MoreHorizontal } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearCompanionAction,
  refuseSlotAction,
  resuggestRecipeAcrossMenuAction,
  resuggestSlotAction,
  type SlotActionState,
} from "@/domain/menu/slot-actions";

export type SlotDishTarget = "main" | "companion";

type SlotCardActionsProps = {
  menuId: string;
  slotId: string;
  hasRecipe: boolean;
  target?: SlotDishTarget;
  /** Show «Убрать» for companion dishes. */
  canClear?: boolean;
};

function ActionError({ state }: { state: SlotActionState }) {
  if (!state || state.ok) return null;
  return (
    <p className="mt-1 text-xs text-warning-fg" role="alert">
      {state.error}
    </p>
  );
}

export function SlotCardActions({
  menuId,
  slotId,
  hasRecipe,
  target = "main",
  canClear = false,
}: SlotCardActionsProps) {
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [suggestState, suggestFormAction, suggestPending] = useActionState<
    SlotActionState,
    FormData
  >(resuggestSlotAction, null);
  const [resuggestState, resuggestFormAction, resuggestPending] =
    useActionState<SlotActionState, FormData>(
      resuggestRecipeAcrossMenuAction,
      null,
    );
  const [refuseState, refuseFormAction, refusePending] = useActionState<
    SlotActionState,
    FormData
  >(refuseSlotAction, null);
  const [clearState, clearFormAction, clearPending] = useActionState<
    SlotActionState,
    FormData
  >(clearCompanionAction, null);

  const busy =
    suggestPending || resuggestPending || refusePending || clearPending;

  function runAction(
    action: (payload: FormData) => void,
    extra?: Record<string, string>,
  ) {
    const fd = new FormData();
    fd.set("menuId", menuId);
    fd.set("slotId", slotId);
    fd.set("target", target);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        fd.set(key, value);
      }
    }
    startTransition(() => {
      action(fd);
    });
  }

  return (
    <div data-component="slot-actions" data-target={target} className="contents">
      <div className="absolute right-2 top-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
              disabled={busy}
              aria-label={
                target === "companion"
                  ? "Действия с компаньоном"
                  : "Действия со слотом"
              }
              aria-busy={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[13rem] rounded-md border-border"
          >
            {hasRecipe ? (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => runAction(resuggestFormAction)}
              >
                {resuggestPending ? "Заменяем…" : "Заменить"}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => runAction(suggestFormAction)}
              >
                {suggestPending ? "Подбираем…" : "Предложить"}
              </DropdownMenuItem>
            )}
            {canClear ? (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => runAction(clearFormAction)}
              >
                {clearPending ? "Убираем…" : "Убрать"}
              </DropdownMenuItem>
            ) : null}
            {hasRecipe ? (
              <DropdownMenuItem
                disabled={busy}
                className="text-warning-fg focus:bg-background focus:text-warning-fg"
                onSelect={() => setRefuseOpen(true)}
              >
                Никогда не предлагать
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-1 space-y-0.5 pr-10">
        <ActionError state={suggestState} />
        <ActionError state={resuggestState} />
        <ActionError state={refuseState} />
        <ActionError state={clearState} />
      </div>

      <CommentDialog
        open={refuseOpen}
        onOpenChange={setRefuseOpen}
        title="Никогда не предлагать"
        description="Блюдо уберём из этого меню и больше не будем предлагать. Напишите почему — генератор учтёт это дальше."
        submitLabel="Убрать и заменить"
        pending={refusePending}
        error={refuseState && !refuseState.ok ? refuseState.error : null}
        onSubmit={(comment) => {
          setRefuseOpen(false);
          runAction(refuseFormAction, { comment });
        }}
      />
    </div>
  );
}
