"use client";

import { MoreHorizontal } from "lucide-react";
import {
  startTransition,
  useActionState,
  useLayoutEffect,
  useState,
} from "react";

import { CommentDialog } from "@/components/feedback/comment-dialog";
import { clearBodyPointerEvents } from "@/components/menu/clear-body-pointer-events";
import {
  CookFeedbackMenuItems,
  planningLocked,
} from "@/components/menu/cook-feedback-menu";
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
import {
  setDishRatingAction,
  togglePreparedAction,
  type CookFeedbackActionState,
} from "@/domain/menu/cook-feedback-actions";
import type { MenuDishRating } from "@/domain/menu/load-menu";
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
  /** Menu dish id — required for cook feedback on filled lines. */
  dishId?: string | null;
  prepared?: boolean;
  rating?: MenuDishRating | null;
  /** When set, across-menu replace/modify/refuse animates every card with this dish. */
  recipeId?: string | null;
  target?: SlotDishTarget;
  /** Show «Убрать» for clearable secondary roles (MVP: carb). */
  canClear?: boolean;
  /** Sheet rows: keep ⋯ in-flow (avoid absolute/`contents` grid pollution). */
  placement?: "overlay" | "inline";
};

function ActionError({ state }: { state: SlotActionState | CookFeedbackActionState }) {
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

export function SlotCardActions({
  menuId,
  slotId,
  hasRecipe,
  dishId = null,
  prepared = false,
  rating = null,
  recipeId = null,
  target = "main",
  canClear = false,
  placement = "overlay",
}: SlotCardActionsProps) {
  const { recipeBusyLabel, setRecipeBusy, setActionBusy } = useMenuSlotBusy();
  const [menuOpen, setMenuOpen] = useState(false);
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
  const [preparedState, preparedFormAction, preparedPending] = useActionState<
    CookFeedbackActionState,
    FormData
  >(togglePreparedAction, null);
  const [ratingState, ratingFormAction, ratingPending] = useActionState<
    CookFeedbackActionState,
    FormData
  >(setDishRatingAction, null);

  const locked = planningLocked(prepared, rating);
  const showCookFeedback = Boolean(hasRecipe && dishId);

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
    clearPending ||
    preparedPending ||
    ratingPending;

  useLayoutEffect(() => {
    const key = `${slotId}:${target}`;
    setActionBusy(key, localBusy);
    return () => setActionBusy(key, false);
  }, [localBusy, setActionBusy, slotId, target]);

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

  useLayoutEffect(() => {
    if (!busy) return;
    setMenuOpen(false);
    clearBodyPointerEvents();
  }, [busy]);

  function closeMenu() {
    setMenuOpen(false);
    clearBodyPointerEvents();
  }

  function openDialogAfterMenu(open: () => void) {
    closeMenu();
    // Let DropdownMenu's dismissable-layer release body lock before Dialog mounts.
    requestAnimationFrame(() => {
      clearBodyPointerEvents();
      open();
    });
  }

  function runAction(
    action: (payload: FormData) => void,
    extra?: Record<string, string>,
  ) {
    closeMenu();
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

  function runCookFeedback(
    action: (payload: FormData) => void,
    extra?: Record<string, string>,
  ) {
    if (!dishId) return;
    closeMenu();
    const fd = new FormData();
    fd.set("menuId", menuId);
    fd.set("dishId", dishId);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        fd.set(key, value);
      }
    }
    startTransition(() => {
      action(fd);
    });
  }

  const inline = placement === "inline";

  const actionsChrome = (
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
              aria-label={`Действия: ${plateRoleLabelRu(target)}`}
              aria-busy={busy}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[13rem] rounded-md border-border"
            data-component="menu-dish-actions"
          >
            {hasRecipe ? (
              <>
                {!locked ? (
                  <>
                    <DropdownMenuItem
                      disabled={busy}
                      className="focus:bg-background focus:text-primary"
                      onSelect={() => runAction(resuggestFormAction)}
                    >
                      {resuggestPending ? "Заменяем…" : "Заменить"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={busy}
                      className="focus:bg-background focus:text-primary"
                      onSelect={() =>
                        openDialogAfterMenu(() => setModifyOpen(true))
                      }
                    >
                      {modifyPending ? "Изменяем…" : "Изменить"}
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuItem
                  disabled={busy}
                  className="text-warning-fg focus:bg-background focus:text-warning-fg"
                  onSelect={() => openDialogAfterMenu(() => setRefuseOpen(true))}
                >
                  Не предлагать
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => runAction(suggestFormAction)}
              >
                {suggestPending ? "Подбираем…" : "Предложить"}
              </DropdownMenuItem>
            )}
            {canClear && !locked ? (
              <DropdownMenuItem
                disabled={busy}
                className="focus:bg-background focus:text-primary"
                onSelect={() => runAction(clearFormAction)}
              >
                {clearPending ? "Убираем…" : "Убрать"}
              </DropdownMenuItem>
            ) : null}
            {showCookFeedback ? (
              <CookFeedbackMenuItems
                prepared={prepared}
                rating={rating}
                busy={busy}
                onTogglePrepared={() => runCookFeedback(preparedFormAction)}
                onRate={(value) =>
                  runCookFeedback(ratingFormAction, { rating: value })
                }
              />
            ) : null}
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
          <ActionError state={suggestState} />
          <ActionError state={resuggestState} />
          <ActionError state={modifyState} />
          <ActionError state={refuseState} />
          <ActionError state={clearState} />
          <ActionError state={preparedState} />
          <ActionError state={ratingState} />
        </div>
      ) : null}
    </>
  );

  const dialogs = (
    <>
      <CommentDialog
        open={modifyOpen}
        onOpenChange={(open) => {
          setModifyOpen(open);
          if (!open) clearBodyPointerEvents();
        }}
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
          clearBodyPointerEvents();
          runAction(modifyFormAction, { comment });
        }}
      />

      <CommentDialog
        open={refuseOpen}
        onOpenChange={(open) => {
          setRefuseOpen(open);
          if (!open) clearBodyPointerEvents();
        }}
        title="Не предлагать"
        description="Блюдо уберём из этого меню и больше не будем предлагать. Напишите почему — генератор учтёт это дальше."
        submitLabel="Убрать и заменить"
        pending={refusePending}
        error={refuseState && !refuseState.ok ? refuseState.error : null}
        onSubmit={(comment) => {
          setRefuseOpen(false);
          clearBodyPointerEvents();
          runAction(refuseFormAction, { comment });
        }}
      />
    </>
  );

  if (inline) {
    return (
      <>
        {generating ? <SlotGeneratingOverlay label={overlayLabel} /> : null}
        <div
          data-component="slot-actions"
          data-target={target}
          className="relative z-10 flex shrink-0 flex-col items-end"
        >
          {actionsChrome}
        </div>
        {dialogs}
      </>
    );
  }

  return (
    <div
      data-component="slot-actions"
      data-target={target}
      className="contents"
    >
      {generating ? <SlotGeneratingOverlay label={overlayLabel} /> : null}
      {actionsChrome}
      {dialogs}
    </div>
  );
}
