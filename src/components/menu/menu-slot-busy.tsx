"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MenuSlotBusyContextValue = {
  isAnyBusy: boolean;
  recipeBusyLabel: (recipeId: string) => string | null;
  snackBusyLabel: (snackLabel: string) => string | null;
  setRecipeBusy: (recipeId: string, label: string | null) => void;
  setSnackBusy: (snackLabel: string, label: string | null) => void;
  setActionBusy: (key: string, active: boolean) => void;
};

const MenuSlotBusyContext = createContext<MenuSlotBusyContextValue | null>(
  null,
);

export function MenuSlotBusyProvider({ children }: { children: ReactNode }) {
  const [recipeBusy, setRecipeBusyMap] = useState(
    () => new Map<string, string>(),
  );
  const [snackBusy, setSnackBusyMap] = useState(
    () => new Map<string, string>(),
  );
  const [actionBusy, setActionBusyMap] = useState(
    () => new Set<string>(),
  );

  const setRecipeBusy = useCallback(
    (recipeId: string, label: string | null) => {
      setRecipeBusyMap((prev) => {
        const current = prev.get(recipeId) ?? null;
        if (current === label) return prev;
        const next = new Map(prev);
        if (label === null) next.delete(recipeId);
        else next.set(recipeId, label);
        return next;
      });
    },
    [],
  );

  const setSnackBusy = useCallback(
    (snackLabel: string, label: string | null) => {
      const key = snackLabel.trim().toLowerCase();
      if (!key) return;
      setSnackBusyMap((prev) => {
        const current = prev.get(key) ?? null;
        if (current === label) return prev;
        const next = new Map(prev);
        if (label === null) next.delete(key);
        else next.set(key, label);
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

  const value = useMemo<MenuSlotBusyContextValue>(
    () => ({
      isAnyBusy:
        recipeBusy.size > 0 || snackBusy.size > 0 || actionBusy.size > 0,
      recipeBusyLabel: (recipeId) => recipeBusy.get(recipeId) ?? null,
      snackBusyLabel: (snackLabel) =>
        snackBusy.get(snackLabel.trim().toLowerCase()) ?? null,
      setRecipeBusy,
      setSnackBusy,
      setActionBusy,
    }),
    [
      recipeBusy,
      snackBusy,
      actionBusy,
      setRecipeBusy,
      setSnackBusy,
      setActionBusy,
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
