"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MIN_FEEDBACK_COMMENT_LENGTH,
} from "@/domain/history/constants";

type CommentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  placeholder?: string;
  fieldLabel?: string;
  hint?: string;
  submitLabel?: string;
  pendingLabel?: string;
  pending?: boolean;
  error?: string | null;
  /** Called with trimmed comment when user submits. */
  onSubmit: (comment: string) => void | Promise<void>;
};

export function CommentDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder = "Например: не люблю тушёную капусту",
  fieldLabel = "Причина",
  hint = `Минимум ${MIN_FEEDBACK_COMMENT_LENGTH} символа. Учитывается при следующих генерациях меню.`,
  submitLabel = "Сохранить",
  pendingLabel = "Сохраняем…",
  pending = false,
  error = null,
  onSubmit,
}: CommentDialogProps) {
  const [comment, setComment] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) setComment("");
    onOpenChange(next);
  }

  const trimmed = comment.trim();
  const tooShort =
    trimmed.length > 0 && trimmed.length < MIN_FEEDBACK_COMMENT_LENGTH;
  const canSubmit =
    trimmed.length >= MIN_FEEDBACK_COMMENT_LENGTH &&
    trimmed.length <= MAX_FEEDBACK_COMMENT_LENGTH &&
    !pending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-component="comment-dialog"
        className="z-[70]"
        overlayClassName="z-[65]"
        onOpenAutoFocus={(e) => {
          // Prefer focusing the textarea over fighting a stacked recipe dialog.
          e.preventDefault();
          const root = e.currentTarget as HTMLElement;
          root.querySelector("textarea")?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
            {fieldLabel}
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={placeholder}
            maxLength={MAX_FEEDBACK_COMMENT_LENGTH}
            rows={4}
            disabled={pending}
            className="flex min-h-[96px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          <p className="text-xs text-muted-foreground">{hint}</p>
          {tooShort ? (
            <p className="text-xs text-warning-fg" role="alert">
              Напишите чуть подробнее.
            </p>
          ) : null}
          {error ? (
            <p className="text-xs text-warning-fg" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              className="rounded-sm"
              disabled={pending}
              onClick={() => handleOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="button"
              className="rounded-sm"
              disabled={!canSubmit}
              aria-busy={pending}
              onClick={() => void onSubmit(trimmed)}
            >
              {pending ? pendingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
