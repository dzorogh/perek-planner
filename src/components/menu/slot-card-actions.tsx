"use client";

import { MoreHorizontal } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { SlotGeneratingOverlay } from "@/components/menu/slot-generating-overlay";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MIN_FEEDBACK_COMMENT_LENGTH } from "@/domain/history/constants";
import {
  clearCompanionAction,
  modifyRecipeAcrossMenuAction,
  refuseSlotAction,
  resuggestRecipeAcrossMenuAction,
  resuggestSlotAction,
  suggestCompanionAction,
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
  /** Show «Добавить гарнир» when main has no companion. */
  canAddCompanion?: boolean;
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
  addCompanionPending: boolean;
  modifyPending: boolean;
}): string {
  if (flags.addCompanionPending) return "Добавляем…";
  if (flags.suggestPending) return "Подбираем…";
  if (flags.modifyPending) return "Изменяем…";
  return "Заменяем…";
}

type SlotActionMenuProps = {
  busy: boolean;
  hasRecipe: boolean;
  canClear: boolean;
  canAddCompanion: boolean;
  suggestPending: boolean;
  addCompanionPending: boolean;
  resuggestPending: boolean;
  modifyPending: boolean;
  clearPending: boolean;
  onSuggest: () => void;
  onAddCompanion: () => void;
  onResuggest: () => void;
  onModify: () => void;
  onClear: () => void;
  onRefuse: () => void;
};

function FilledDishMenuItems({
  busy,
  canAddCompanion,
  addCompanionPending,
  resuggestPending,
  modifyPending,
  onAddCompanion,
  onResuggest,
  onModify,
  onRefuse,
}: {
  busy: boolean;
  canAddCompanion: boolean;
  addCompanionPending: boolean;
  resuggestPending: boolean;
  modifyPending: boolean;
  onAddCompanion: () => void;
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
      {canAddCompanion ? (
        <DropdownMenuItem
          disabled={busy}
          className="focus:bg-background focus:text-primary"
          onSelect={onAddCompanion}
        >
          {addCompanionPending ? "Добавляем…" : "Добавить гарнир"}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuItem
        disabled={busy}
        className="text-warning-fg focus:bg-background focus:text-warning-fg"
        onSelect={onRefuse}
      >
        Никогда не предлагать
      </DropdownMenuItem>
    </>
  );
}

function SlotActionMenu({
  busy,
  hasRecipe,
  canClear,
  canAddCompanion,
  suggestPending,
  addCompanionPending,
  resuggestPending,
  modifyPending,
  clearPending,
  onSuggest,
  onAddCompanion,
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
          canAddCompanion={canAddCompanion}
          addCompanionPending={addCompanionPending}
          resuggestPending={resuggestPending}
          modifyPending={modifyPending}
          onAddCompanion={onAddCompanion}
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
  target = "main",
  canClear = false,
  canAddCompanion = false,
}: SlotCardActionsProps) {
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [suggestState, suggestFormAction, suggestPending] = useActionState<
    SlotActionState,
    FormData
  >(resuggestSlotAction, null);
  const [addCompanionState, addCompanionFormAction, addCompanionPending] =
    useActionState<SlotActionState, FormData>(suggestCompanionAction, null);
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

  const busy =
    suggestPending ||
    addCompanionPending ||
    resuggestPending ||
    modifyPending ||
    refusePending ||
    clearPending;
  const generating =
    suggestPending ||
    addCompanionPending ||
    resuggestPending ||
    modifyPending ||
    refusePending;

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
      {generating ? (
        <SlotGeneratingOverlay
          label={generatingOverlayLabel({
            suggestPending,
            addCompanionPending,
            modifyPending,
          })}
        />
      ) : null}
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
          <SlotActionMenu
            busy={busy}
            hasRecipe={hasRecipe}
            canClear={canClear}
            canAddCompanion={canAddCompanion}
            suggestPending={suggestPending}
            addCompanionPending={addCompanionPending}
            resuggestPending={resuggestPending}
            modifyPending={modifyPending}
            clearPending={clearPending}
            onSuggest={() => runAction(suggestFormAction)}
            onAddCompanion={() => runAction(addCompanionFormAction)}
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
          <ActionError state={addCompanionState} />
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
