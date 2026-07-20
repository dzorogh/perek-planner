"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  MAX_FEEDBACK_COMMENT_LENGTH,
  MIN_FEEDBACK_COMMENT_LENGTH,
} from "@/domain/history/constants";
import {
  addTastePreferenceAction,
  deleteTastePreferenceAction,
  type TastePreferenceActionState,
} from "@/domain/settings/taste-preference-actions";
import {
  TASTE_PREFERENCE_KIND_LABELS_RU,
  type TastePreference,
  type TastePreferenceKind,
} from "@/domain/settings/taste-preferences";

type TastePreferencesPanelProps = {
  items: TastePreference[];
};

export function TastePreferencesPanel({ items }: TastePreferencesPanelProps) {
  const [kind, setKind] = useState<TastePreferenceKind>("ban");
  const formRef = useRef<HTMLFormElement>(null);

  const [addState, addAction, addPending] = useActionState<
    TastePreferenceActionState,
    FormData
  >(addTastePreferenceAction, null);

  useEffect(() => {
    if (addState?.ok) {
      formRef.current?.reset();
      setKind("ban");
    }
  }, [addState]);

  return (
    <section
      className="rounded-lg border border-border bg-surface px-5 py-5"
      data-component="taste-preferences"
    >
      <h2 className="text-base font-semibold text-foreground">
        Пожелания и запреты
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Учитываются при генерации меню. Запрет — жёстко не предлагать;
        пожелание — предпочитать, когда можно.
      </p>

      <form
        ref={formRef}
        action={addAction}
        className="mt-4 space-y-3"
      >
        <div className="flex gap-2">
          <KindToggle kind={kind} onChange={setKind} />
          <input type="hidden" name="kind" value={kind} />
        </div>
        <label className="block text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
          Текст
        </label>
        <textarea
          name="body"
          rows={2}
          maxLength={MAX_FEEDBACK_COMMENT_LENGTH}
          placeholder={
            kind === "ban"
              ? "Например: без гречки и капусты"
              : "Например: чаще рыбу на ужин"
          }
          disabled={addPending}
          className="flex min-h-[64px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground">
          Минимум {MIN_FEEDBACK_COMMENT_LENGTH} символа.
        </p>
        {addState && !addState.ok ? (
          <p className="text-xs text-warning-fg" role="alert">
            {addState.error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="submit"
            className="rounded-sm"
            disabled={addPending}
            aria-busy={addPending}
          >
            {addPending ? "Сохраняем…" : "Добавить"}
          </Button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Пока пусто — добавьте запрет или пожелание выше.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {items.map((item) => (
            <PreferenceRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

function KindToggle({
  kind,
  onChange,
}: {
  kind: TastePreferenceKind;
  onChange: (kind: TastePreferenceKind) => void;
}) {
  return (
    <div
      className="inline-flex rounded-sm border border-border bg-background p-0.5"
      role="group"
      aria-label="Тип записи"
    >
      {(["ban", "wish"] as const).map((value) => {
        const active = kind === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={
              active
                ? "rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                : "rounded-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
            }
          >
            {TASTE_PREFERENCE_KIND_LABELS_RU[value]}
          </button>
        );
      })}
    </div>
  );
}

function PreferenceRow({ item }: { item: TastePreference }) {
  const [state, action, pending] = useActionState<
    TastePreferenceActionState,
    FormData
  >(deleteTastePreferenceAction, null);

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <span
          className={
            item.kind === "ban"
              ? "inline-block text-[11px] font-semibold uppercase tracking-[0.04em] text-warning-fg"
              : "inline-block text-[11px] font-semibold uppercase tracking-[0.04em] text-secondary-foreground"
          }
        >
          {TASTE_PREFERENCE_KIND_LABELS_RU[item.kind]}
        </span>
        <p className="mt-0.5 text-sm text-foreground">{item.body}</p>
        {state && !state.ok ? (
          <p className="mt-1 text-xs text-warning-fg" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
      <form action={action}>
        <input type="hidden" name="id" value={item.id} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-sm text-muted-foreground"
          disabled={pending}
          aria-busy={pending}
        >
          {pending ? "…" : "Удалить"}
        </Button>
      </form>
    </li>
  );
}
