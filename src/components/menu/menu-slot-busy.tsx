"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { MenuBusyBroadcastPayload } from "@/domain/menu/menu-live-sync-logic";

type BusyPublishEvent = Omit<MenuBusyBroadcastPayload, "senderId">;
type BusyPublisher = (event: BusyPublishEvent) => void;

type MenuSlotBusyContextValue = {
  /** Local pending actions only — gates remote router.refresh. */
  isAnyBusy: boolean;
  recipeBusyLabel: (recipeId: string) => string | null;
  snackBusyLabel: (snackLabel: string) => string | null;
  setRecipeBusy: (recipeId: string, label: string | null) => void;
  setSnackBusy: (snackLabel: string, label: string | null) => void;
  setActionBusy: (key: string, active: boolean) => void;
  /** Apply busy from another tab (does not re-broadcast; does not gate refresh). */
  applyRemoteBusy: (
    event: Pick<MenuBusyBroadcastPayload, "kind" | "key" | "label">,
  ) => void;
  /** Drop peer overlays after dish rows change (clear broadcast may be lost). */
  clearAllRemoteBusy: () => void;
  /** MenuLiveSync registers the Realtime broadcast sender. */
  registerBusyPublisher: (publisher: BusyPublisher | null) => void;
};

const MenuSlotBusyContext = createContext<MenuSlotBusyContextValue | null>(
  null,
);

function snackKey(label: string): string {
  return label.trim().toLowerCase();
}

export function MenuSlotBusyProvider({ children }: { children: ReactNode }) {
  const [localRecipeBusy, setLocalRecipeBusy] = useState(
    () => new Map<string, string>(),
  );
  const [localSnackBusy, setLocalSnackBusy] = useState(
    () => new Map<string, string>(),
  );
  const [remoteRecipeBusy, setRemoteRecipeBusy] = useState(
    () => new Map<string, string>(),
  );
  const [remoteSnackBusy, setRemoteSnackBusy] = useState(
    () => new Map<string, string>(),
  );
  const [actionBusy, setActionBusyMap] = useState(
    () => new Set<string>(),
  );
  const publisherRef = useRef<BusyPublisher | null>(null);
  const lastPublishedRef = useRef(new Map<string, string | null>());
  const localRecipeRef = useRef(localRecipeBusy);
  const localSnackRef = useRef(localSnackBusy);
  localRecipeRef.current = localRecipeBusy;
  localSnackRef.current = localSnackBusy;

  const publishIfChanged = useCallback(
    (kind: "recipe" | "snack", key: string, label: string | null) => {
      const mapKey = `${kind}:${key}`;
      const prev = lastPublishedRef.current.get(mapKey);
      if (prev === label) return;
      if (prev === undefined && label === null) return;
      if (label === null) lastPublishedRef.current.delete(mapKey);
      else lastPublishedRef.current.set(mapKey, label);
      publisherRef.current?.({ kind, key, label });
    },
    [],
  );

  const replayLocalBusy = useCallback((publisher: BusyPublisher) => {
    for (const [key, label] of localRecipeRef.current) {
      publisher({ kind: "recipe", key, label });
    }
    for (const [key, label] of localSnackRef.current) {
      publisher({ kind: "snack", key, label });
    }
  }, []);

  const setRecipeBusy = useCallback(
    (recipeId: string, label: string | null) => {
      const id = recipeId.trim();
      if (!id) return;
      setLocalRecipeBusy((prev) => {
        const current = prev.get(id) ?? null;
        if (current === label) return prev;
        const next = new Map(prev);
        if (label === null) next.delete(id);
        else next.set(id, label);
        return next;
      });
      publishIfChanged("recipe", id, label);
    },
    [publishIfChanged],
  );

  const setSnackBusy = useCallback(
    (snackLabel: string, label: string | null) => {
      const key = snackKey(snackLabel);
      if (!key) return;
      setLocalSnackBusy((prev) => {
        const current = prev.get(key) ?? null;
        if (current === label) return prev;
        const next = new Map(prev);
        if (label === null) next.delete(key);
        else next.set(key, label);
        return next;
      });
      publishIfChanged("snack", key, label);
    },
    [publishIfChanged],
  );

  const applyRemoteBusy = useCallback(
    (event: Pick<MenuBusyBroadcastPayload, "kind" | "key" | "label">) => {
      if (event.kind === "recipe") {
        const id = event.key.trim();
        if (!id) return;
        // Never clobber a still-running local overlay on this tab.
        if (localRecipeRef.current.has(id) && event.label === null) return;
        setRemoteRecipeBusy((prev) => {
          const current = prev.get(id) ?? null;
          if (current === event.label) return prev;
          const next = new Map(prev);
          if (event.label === null) next.delete(id);
          else next.set(id, event.label);
          return next;
        });
        return;
      }
      const key = snackKey(event.key);
      if (!key) return;
      if (localSnackRef.current.has(key) && event.label === null) return;
      setRemoteSnackBusy((prev) => {
        const current = prev.get(key) ?? null;
        if (current === event.label) return prev;
        const next = new Map(prev);
        if (event.label === null) next.delete(key);
        else next.set(key, event.label);
        return next;
      });
    },
    [],
  );

  const setActionBusy = useCallback((key: string, active: boolean) => {
    const id = key.trim();
    if (!id) return;
    setActionBusyMap((prev) => {
      const has = prev.has(id);
      if (active === has) return prev;
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearAllRemoteBusy = useCallback(() => {
    setRemoteRecipeBusy((prev) => (prev.size === 0 ? prev : new Map()));
    setRemoteSnackBusy((prev) => (prev.size === 0 ? prev : new Map()));
  }, []);

  const registerBusyPublisher = useCallback(
    (publisher: BusyPublisher | null) => {
      publisherRef.current = publisher;
      if (!publisher) return;
      // Channel (re)subscribed — resend active local busy (Strict Mode / reconnect).
      lastPublishedRef.current.clear();
      replayLocalBusy((event) => {
        const mapKey = `${event.kind}:${event.key}`;
        lastPublishedRef.current.set(mapKey, event.label);
        publisher(event);
      });
    },
    [replayLocalBusy],
  );

  const value = useMemo<MenuSlotBusyContextValue>(
    () => ({
      isAnyBusy:
        localRecipeBusy.size > 0 ||
        localSnackBusy.size > 0 ||
        actionBusy.size > 0,
      recipeBusyLabel: (recipeId) => {
        const id = recipeId.trim();
        return (
          localRecipeBusy.get(id) ?? remoteRecipeBusy.get(id) ?? null
        );
      },
      snackBusyLabel: (snackLabel) => {
        const key = snackKey(snackLabel);
        return localSnackBusy.get(key) ?? remoteSnackBusy.get(key) ?? null;
      },
      setRecipeBusy,
      setSnackBusy,
      setActionBusy,
      applyRemoteBusy,
      clearAllRemoteBusy,
      registerBusyPublisher,
    }),
    [
      localRecipeBusy,
      localSnackBusy,
      remoteRecipeBusy,
      remoteSnackBusy,
      actionBusy,
      setRecipeBusy,
      setSnackBusy,
      setActionBusy,
      applyRemoteBusy,
      clearAllRemoteBusy,
      registerBusyPublisher,
    ],
  );

  return (
    <MenuSlotBusyContext.Provider value={value}>
      {children}
    </MenuSlotBusyContext.Provider>
  );
}

export function useMenuSlotBusy(): MenuSlotBusyContextValue {
  const ctx = useContext(MenuSlotBusyContext);
  if (!ctx) {
    throw new Error("useMenuSlotBusy must be used within MenuSlotBusyProvider");
  }
  return ctx;
}
