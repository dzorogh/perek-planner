"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useMenuSlotBusy } from "@/components/menu/menu-slot-busy";
import {
  menuSlotDishEventMatchesMenu,
  shouldApplyRemoteMenuRefresh,
} from "@/domain/menu/menu-live-sync-logic";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 350;
const NOTICE_MS = 2500;
const OWN_ECHO_SUPPRESS_MS = 2000;

type MenuLiveSyncProps = {
  menuId: string;
  slotIds: readonly string[];
};

type DishRow = {
  menu_slot_id?: string | null;
};

export function MenuLiveSync({ menuId, slotIds }: MenuLiveSyncProps) {
  const router = useRouter();
  const { isAnyBusy } = useMenuSlotBusy();
  const [notice, setNotice] = useState(false);

  const isAnyBusyRef = useRef(isAnyBusy);
  const slotIdsRef = useRef(new Set(slotIds));
  const pendingWhileBusyRef = useRef(false);
  const suppressNoticeUntilRef = useRef(0);
  const aliveRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  const wasBusyRef = useRef(isAnyBusy);

  useLayoutEffect(() => {
    isAnyBusyRef.current = isAnyBusy;
    if (wasBusyRef.current && !isAnyBusy) {
      suppressNoticeUntilRef.current = Date.now() + OWN_ECHO_SUPPRESS_MS;
    }
    wasBusyRef.current = isAnyBusy;
  }, [isAnyBusy]);

  const slotIdsKey = slotIds.join(",");
  useEffect(() => {
    slotIdsRef.current = new Set(
      slotIdsKey.length > 0 ? slotIdsKey.split(",") : [],
    );
  }, [slotIdsKey]);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    aliveRef.current = true;
    if (!menuId) return;

    let cancelled = false;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let authSub: { unsubscribe: () => void } | null = null;

    function showNotice() {
      if (!aliveRef.current) return;
      if (Date.now() < suppressNoticeUntilRef.current) return;
      setNotice(true);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        if (aliveRef.current) setNotice(false);
      }, NOTICE_MS);
    }

    function runRefresh() {
      if (!aliveRef.current) return;
      if (!shouldApplyRemoteMenuRefresh(isAnyBusyRef.current)) {
        pendingWhileBusyRef.current = true;
        return;
      }
      routerRef.current.refresh();
      showNotice();
    }

    function scheduleRefresh() {
      if (!aliveRef.current) return;
      if (!shouldApplyRemoteMenuRefresh(isAnyBusyRef.current)) {
        pendingWhileBusyRef.current = true;
        return;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        runRefresh();
      }, DEBOUNCE_MS);
    }

    async function start() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const token = data.session?.access_token;
      // Without JWT, Realtime connects as anon and RLS drops all postgres_changes.
      if (token) await supabase.realtime.setAuth(token);

      if (cancelled) return;

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.access_token) {
          void supabase.realtime.setAuth(session.access_token);
        }
      });
      authSub = subscription;

      const onMenuScoped = () => {
        scheduleRefresh();
      };

      const onDish = (payload: {
        new?: DishRow | null;
        old?: DishRow | null;
      }) => {
        const nextId = payload.new?.menu_slot_id;
        const prevId = payload.old?.menu_slot_id;
        const match =
          menuSlotDishEventMatchesMenu(nextId, slotIdsRef.current) ||
          menuSlotDishEventMatchesMenu(prevId, slotIdsRef.current);
        if (match) scheduleRefresh();
      };

      channel = supabase
        .channel(`menu-live:${menuId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menus",
            filter: `id=eq.${menuId}`,
          },
          onMenuScoped,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_slots",
            filter: `menu_id=eq.${menuId}`,
          },
          onMenuScoped,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_snacks",
            filter: `menu_id=eq.${menuId}`,
          },
          onMenuScoped,
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "menu_slot_dishes",
          },
          onDish,
        )
        .subscribe();
    }

    void start();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      authSub?.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [menuId]);

  useEffect(() => {
    if (isAnyBusy || !pendingWhileBusyRef.current) return;
    pendingWhileBusyRef.current = false;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!aliveRef.current) return;
      if (!shouldApplyRemoteMenuRefresh(isAnyBusyRef.current)) {
        pendingWhileBusyRef.current = true;
        return;
      }
      routerRef.current.refresh();
      if (Date.now() < suppressNoticeUntilRef.current) return;
      setNotice(true);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        if (aliveRef.current) setNotice(false);
      }, NOTICE_MS);
    }, DEBOUNCE_MS);
  }, [isAnyBusy]);

  if (!notice) return null;

  return (
    <p
      data-component="menu-live-sync-notice"
      className="mt-2 text-sm text-muted-foreground"
      role="status"
    >
      Меню обновлено
    </p>
  );
}
