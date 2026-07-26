"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useMenuSlotBusy } from "@/components/menu/menu-slot-busy";
import {
  MENU_BUSY_BROADCAST_EVENT,
  menuSlotDishEventMatchesMenu,
  parseMenuBusyBroadcastPayload,
  shouldApplyRemoteBusy,
  shouldApplyRemoteMenuRefresh,
  type MenuBusyBroadcastPayload,
} from "@/domain/menu/menu-live-sync-logic";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 350;
const NOTICE_MS = 2500;
const OWN_ECHO_SUPPRESS_MS = 2000;
/** Clear remote busy if the acting tab never sends a clear (crash / offline). */
const REMOTE_BUSY_TTL_MS = 3 * 60_000;

type MenuLiveSyncProps = {
  menuId: string;
  slotIds: readonly string[];
};

type DishRow = {
  menu_slot_id?: string | null;
};

export function MenuLiveSync({ menuId, slotIds }: MenuLiveSyncProps) {
  const router = useRouter();
  const {
    isAnyBusy,
    applyRemoteBusy,
    clearAllRemoteBusy,
    registerBusyPublisher,
  } = useMenuSlotBusy();
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
  const selfIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sync-${Math.random().toString(36).slice(2)}`,
  );
  const remoteBusyTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const channelSendRef = useRef<
    ((payload: MenuBusyBroadcastPayload) => void) | null
  >(null);
  const pendingBusyRef = useRef<MenuBusyBroadcastPayload[]>([]);
  const applyRemoteBusyRef = useRef(applyRemoteBusy);
  const clearAllRemoteBusyRef = useRef(clearAllRemoteBusy);

  useLayoutEffect(() => {
    applyRemoteBusyRef.current = applyRemoteBusy;
  }, [applyRemoteBusy]);

  useLayoutEffect(() => {
    clearAllRemoteBusyRef.current = clearAllRemoteBusy;
  }, [clearAllRemoteBusy]);

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
      // Dish rows changed — peer overlay can drop even if clear broadcast was lost.
      clearAllRemoteBusyRef.current();
      for (const timer of remoteBusyTimersRef.current.values()) {
        clearTimeout(timer);
      }
      remoteBusyTimersRef.current.clear();
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

    function clearRemoteBusyTimer(mapKey: string) {
      const timer = remoteBusyTimersRef.current.get(mapKey);
      if (timer) {
        clearTimeout(timer);
        remoteBusyTimersRef.current.delete(mapKey);
      }
    }

    function onBusyBroadcast(raw: unknown) {
      const parsed = parseMenuBusyBroadcastPayload(raw);
      if (!parsed) return;
      if (!shouldApplyRemoteBusy(parsed.senderId, selfIdRef.current)) return;
      if (!aliveRef.current) return;

      const mapKey = `${parsed.kind}:${parsed.key}`;
      clearRemoteBusyTimer(mapKey);
      applyRemoteBusyRef.current({
        kind: parsed.kind,
        key: parsed.key,
        label: parsed.label,
      });

      if (parsed.label !== null) {
        const timer = setTimeout(() => {
          remoteBusyTimersRef.current.delete(mapKey);
          if (!aliveRef.current) return;
          applyRemoteBusyRef.current({
            kind: parsed.kind,
            key: parsed.key,
            label: null,
          });
        }, REMOTE_BUSY_TTL_MS);
        remoteBusyTimersRef.current.set(mapKey, timer);
      }
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
        .channel(`menu-live:${menuId}`, {
          config: { broadcast: { self: false } },
        })
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
        .on(
          "broadcast",
          { event: MENU_BUSY_BROADCAST_EVENT },
          ({ payload }) => {
            onBusyBroadcast(payload);
          },
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED" || !channel) return;
          const send = (busyPayload: MenuBusyBroadcastPayload) => {
            void channel!.send({
              type: "broadcast",
              event: MENU_BUSY_BROADCAST_EVENT,
              payload: busyPayload,
            });
          };
          channelSendRef.current = send;
          const queued = pendingBusyRef.current;
          pendingBusyRef.current = [];
          for (const item of queued) send(item);
        });
    }

    void start();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      channelSendRef.current = null;
      pendingBusyRef.current = [];
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      for (const timer of remoteBusyTimersRef.current.values()) {
        clearTimeout(timer);
      }
      remoteBusyTimersRef.current.clear();
      authSub?.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [menuId]);

  useEffect(() => {
    registerBusyPublisher((event) => {
      const payload: MenuBusyBroadcastPayload = {
        senderId: selfIdRef.current,
        kind: event.kind,
        key: event.key,
        label: event.label,
      };
      if (channelSendRef.current) {
        channelSendRef.current(payload);
        return;
      }
      pendingBusyRef.current = [
        ...pendingBusyRef.current.filter(
          (p) => !(p.kind === payload.kind && p.key === payload.key),
        ),
        payload,
      ];
    });
    return () => registerBusyPublisher(null);
  }, [registerBusyPublisher]);

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
