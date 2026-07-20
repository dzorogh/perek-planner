"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  clearAiDebugLogAction,
  loadAiDebugLogAction,
} from "@/domain/settings/ai-debug-actions";
import type { AiDebugEntry } from "@/lib/openrouter/debug-types";

export function AiDebugPanel() {
  const [entries, setEntries] = useState<AiDebugEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await loadAiDebugLogAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setEntries(result.entries);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const clear = () => {
    startTransition(async () => {
      const result = await clearAiDebugLogAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setEntries([]);
    });
  };

  return (
    <section
      className="rounded-lg border border-border bg-surface px-5 py-5"
      data-component="ai-debug"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Лог нейросети
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Последние запросы и ответы OpenRouter в этом процессе сервера —
            для отладки запретов и промптов.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={refresh}
          >
            Обновить
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending || entries.length === 0}
            onClick={clear}
          >
            Очистить
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Пока пусто — сгенерируйте меню или замените слот, затем нажмите
          «Обновить».
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {entries.map((entry) => (
            <DebugEntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

function DebugEntryCard({ entry }: { entry: AiDebugEntry }) {
  const when = formatWhen(entry.at);
  const status = entry.ok ? "ok" : "ошибка";

  return (
    <li className="rounded-md border border-border bg-background">
      <details>
        <summary className="cursor-pointer list-none px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span
              className={
                entry.ok
                  ? "font-medium text-foreground"
                  : "font-medium text-destructive"
              }
            >
              {status}
            </span>
            <span className="text-muted-foreground">{when}</span>
            <span className="text-muted-foreground">
              {entry.durationMs} мс
            </span>
            <span className="truncate text-muted-foreground">{entry.model}</span>
          </div>
          {entry.error ? (
            <p className="mt-1 text-xs text-destructive">{entry.error}</p>
          ) : null}
        </summary>

        <div className="space-y-3 border-t border-border px-3 py-3">
          {entry.requestMessages.map((message, index) => (
            <MessageBlock
              key={`${entry.id}-${message.role}-${index}`}
              title={`Запрос · ${message.role}`}
              body={message.content}
            />
          ))}
          <MessageBlock
            title="Ответ"
            body={entry.response ?? "(пусто)"}
          />
        </div>
      </details>
    </li>
  );
}

function MessageBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-slot-label">
        {title}
      </p>
      <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-surface p-2 text-xs leading-relaxed text-foreground">
        {prettyJsonIfPossible(body)}
      </pre>
    </div>
  );
}

function prettyJsonIfPossible(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return text;
  }
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return text;
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
