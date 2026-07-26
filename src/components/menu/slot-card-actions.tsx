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
import { MIN_FEEDBACK_COMMENT_LENGTH } from "@/domain/history/constants";
import type { PlateRole } from "@/domain/menu/meal-templates";
import { plateRoleLabelRu } from "@/domain/menu/plate-role-labels";
import {
  clearCompanionAction,
  modifyRecipeAcrossMenuAction,
  refuseSlotAction,
  resuggestRecipeAcrossMenuAction,
  resuggestSlotAction,
  type SlotActionState,
} from "@/domain/menu/slot-actions";

/** Overflow target = Plate role on the line. */
export type SlotDishTarget = PlateRole;

type SlotCardActionsProps = {
  menuId: string;
  slotId: string;
  hasRecipe: boolean;
  /** When set, across-menu replace/modify/refuse animates every card with this dish. */
  recipeId?: string | null;
  target?: SlotDishTarget;
  /** Show «Убрать» for clearable secondary roles (MVP: carb). */
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

function generatingOverlayLabel(flags: {
  suggestPending: boolean;
  modifyPending: boolean;
}): string {
  if (flags.suggestPending) return "Подбираем…";
  if (flags.modifyPending) return "Изменяем…";
  return "Заменяем…";
}

type SlotActionMenuProps = {
  busy: boolean;
  hasRecipe: boolean;
  canClear: boolean;
  suggestPending: boolean;
  resuggestPending: boolean;
  modifyPending: boolean;
  clearPending: boolean;
  onSuggest: () => void;
  onResuggest: () => void;
  onModify: () => void;
  onClear: () => void;
  onRefuse: () => void;
};

function FilledDishMenuItems({
  busy,
  resuggestPending,
  modifyPending,
  onResuggest,
  onModify,
  onRefuse,
}: {
  busy: boolean;
  resuggestPending: boolean;
  modifyPending: boolean;
  onResuggest: () => void;
  onModify: () => void;
  onRefuse: () => void;
}) {
  return (
    <>
      <DropdownMenuItem
        disabled={busy}
        className="focus:bg-background focus:text-primary"
        onSelect={onResuggest}
      >
        {resuggestPending ? "Заменяем…" : "Заменить"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy}
        className="focus:bg-background focus:text-primary"
        onSelect={onModify}
      >
        {modifyPending ? "Изменяем…" : "Изменить"}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={busy}
        className="text-warning-fg focus:bg-background focus:text-warning-fg"
        onSelect={onRefuse}
      >
        Не предлагать
      </DropdownMenuItem>
    </>
  );
}

function SlotActionMenu({
  busy,
  hasRecipe,
  canClear,
  suggestPending,
  resuggestPending,
  modifyPending,
  clearPending,
  onSuggest,
  onResuggest,
  onModify,
  onClear,
  onRefuse,
}: SlotActionMenuProps) {
  return (
    <DropdownMenuContent
      align="end"
      className="min-w-[13rem] rounded-md border-border"
    >
      {hasRecipe ? (
        <FilledDishMenuItems
          busy={busy}
          resuggestPending={resuggestPending}
          modifyPending={modifyPending}
          onResuggest={onResuggest}
          onModify={onModify}
          onRefuse={onRefuse}
        />
      ) : (
        <DropdownMenuItem
          disabled={busy}
          className="focus:bg-background focus:text-primary"
          onSelect={onSuggest}
        >
          {suggestPending ? "Подбираем…" : "Предложить"}
        </DropdownMenuItem>
      )}
      {canClear ? (
        <DropdownMenuItem
          disabled={busy}
          className="focus:bg-background focus:text-primary"
          onSelect={onClear}
        >
          {clearPending ? "Убираем…" : "Убрать"}
        </DropdownMenuItem>
      ) : null}
    </DropdownMenuContent>
  );
}

export function SlotCardActions({
  menuId,
  slotId,
  hasRecipe,
  recipeId = null,
  target = "main",
  canClear = false,
}: SlotCardActionsProps) {
  const { recipeBusyLabel, setRecipeBusy } = useMenuSlotBusy();
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [suggestState, suggestFormAction, suggestPending] = useActionState<
    SlotActionState,
    FormData
  >(resuggestSlotAction, null);
  const [resuggestState, resuggestFormAction, resuggestPending] =
    useActionState<SlotActionState, FormData>(
      resuggestRecipeAcrossMenuAction,
      null,
    );
  const [modifyState, modifyFormAction, modifyPending] = useActionState<
    SlotActionState,
    FormData
  >(modifyRecipeAcrossMenuAction, null);
  const [refuseState, refuseFormAction, refusePending] = useActionState<
    SlotActionState,
    FormData
  >(refuseSlotAction, null);
  const [clearState, clearFormAction, clearPending] = useActionState<
    SlotActionState,
    FormData
  >(clearCompanionAction, null);

  const acrossMenuPending =
    resuggestPending || modifyPending || refusePending;
  const acrossMenuLabel = modifyPending ? "Изменяем…" : "Заменяем…";
  const sharedBusyLabel = recipeId ? recipeBusyLabel(recipeId) : null;

  useLayoutEffect(() => {
    if (!recipeId || !acrossMenuPending) return;
    setRecipeBusy(recipeId, acrossMenuLabel);
    return () => setRecipeBusy(recipeId, null);
  }, [recipeId, acrossMenuPending, acrossMenuLabel, setRecipeBusy]);

  const localBusy =
    suggestPending ||
    resuggestPending ||
    modifyPending ||
    refusePending ||
    clearPending;
  const busy = localBusy || Boolean(sharedBusyLabel);
  const localGenerating =
    suggestPending ||
    resuggestPending ||
    modifyPending ||
    refusePending;
  const generating = localGenerating || Boolean(sharedBusyLabel);
  const overlayLabel = localGenerating
    ? generatingOverlayLabel({
      suggestPending,
      modifyPending,
    })
    : (sharedBusyLabel ?? "Заменяем…");

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
      {generating ? <SlotGeneratingOverlay label={overlayLabel} /> : null}
      <div className="absolute right-2 top-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
              disabled={busy}
              aria-label={`Действия: ${plateRoleLabelRu(target)}`}
              aria-busy={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <SlotActionMenu
            busy={busy}
            hasRecipe={hasRecipe}
            canClear={canClear}
            suggestPending={suggestPending}
            resuggestPending={resuggestPending}
            modifyPending={modifyPending}
            clearPending={clearPending}
            onSuggest={() => runAction(suggestFormAction)}
            onResuggest={() => runAction(resuggestFormAction)}
            onModify={() => setModifyOpen(true)}
            onClear={() => runAction(clearFormAction)}
            onRefuse={() => setRefuseOpen(true)}
          />
        </DropdownMenu>
      </div>

      {!generating ? (
        <div className="relative z-[6] mt-1 space-y-0.5 pr-10">
          <ActionError state={suggestState} />
          <ActionError state={resuggestState} />
          <ActionError state={modifyState} />
          <ActionError state={refuseState} />
          <ActionError state={clearState} />
        </div>
      ) : null}

      <CommentDialog
        open={modifyOpen}
        onOpenChange={setModifyOpen}
        title="Изменить блюдо"
        description="Опишите, что поменять в блюде или рецепте — ИИ сразу подготовит вариант."
        fieldLabel="Пожелание"
        hint={`Минимум ${MIN_FEEDBACK_COMMENT_LENGTH} символа. Один вариант применится ко всем слотам с этим блюдом.`}
        placeholder="Например: без грибов, попроще шаги"
        submitLabel="Изменить"
        pendingLabel="Изменяем…"
        pending={modifyPending}
        error={modifyState && !modifyState.ok ? modifyState.error : null}
        onSubmit={(comment) => {
          setModifyOpen(false);
          runAction(modifyFormAction, { comment });
        }}
      />

      <CommentDialog
        open={refuseOpen}
        onOpenChange={setRefuseOpen}
        title="Не предлагать"
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
