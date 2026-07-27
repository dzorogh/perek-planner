"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import { shouldApplyRemoteShoppingRefresh } from "@/domain/shopping/shopping-live-sync-logic";
import { menuSlotDishEventMatchesMenu } from "@/domain/menu/menu-live-sync-logic";
import { createClient } from "@/lib/supabase/client";

const DEBOUNCE_MS = 350;
const NOTICE_MS = 2500;
const OWN_ECHO_SUPPRESS_MS = 2000;
const TAB_CHANNEL_PREFIX = "keplo-shopping:";

export type ShoppingSelectionPublisher = () => void;

type TabSelectionMessage = {
  type: "shopping-selection-changed";
  menuId: string;
  selfId: string;
};

/** Same-browser cart signal; safe after LiveSync unmount (opens a short-lived channel). */
export function publishShoppingTabSelection(
  menuId: string,
  selfId: string,
): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(`${TAB_CHANNEL_PREFIX}${menuId}`);
  const msg: TabSelectionMessage = {
    type: "shopping-selection-changed",
    menuId,
    selfId,
  };
  channel.postMessage(msg);
  channel.close();
}

type ShoppingLiveSyncProps = {
  menuId: string;
  slotIds: readonly string[];
  /** True while a local cart mutation is in flight — skip disruptive refresh. */
  isPending: boolean;
  /** Parent calls after successful persist (same-browser BroadcastChannel). */
  publishRef: MutableRefObject<ShoppingSelectionPublisher | null>;
};

type DishRow = {
  menu_slot_id?: string | null;
};

export function ShoppingLiveSync({
  menuId,
  slotIds,
  isPending,
  publishRef,
}: ShoppingLiveSyncProps) {
  const router = useRouter();
  const [notice, setNotice] = useState(false);

  const isPendingRef = useRef(isPending);
  const slotIdsRef = useRef(new Set(slotIds));
  const pendingWhileBusyRef = useRef(false);
  const suppressNoticeUntilRef = useRef(0);
  const aliveRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routerRef = useRef(router);
  const wasPendingRef = useRef(isPending);
  const selfIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `shop-${Math.random().toString(36).slice(2)}`,
  );

  useLayoutEffect(() => {
    isPendingRef.current = isPending;
    if (wasPendingRef.current && !isPending) {
      suppressNoticeUntilRef.current = Date.now() + OWN_ECHO_SUPPRESS_MS;
    }
    wasPendingRef.current = isPending;
  }, [isPending]);

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
    let tabChannel: BroadcastChannel | null = null;

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
      if (!shouldApplyRemoteShoppingRefresh(isPendingRef.current)) {
        pendingWhileBusyRef.current = true;
        return;
      }
      // Match menu-live: always refresh; suppress only the notice (own echo).
      routerRef.current.refresh();
      showNotice();
    }

    function scheduleRefresh() {
      if (!aliveRef.current) return;
      if (!shouldApplyRemoteShoppingRefresh(isPendingRef.current)) {
        pendingWhileBusyRef.current = true;
        return;
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        runRefresh();
      }, DEBOUNCE_MS);
    }

    publishRef.current = () => {
      publishShoppingTabSelection(menuId, selfIdRef.current);
    };

    if (typeof BroadcastChannel !== "undefined") {
      tabChannel = new BroadcastChannel(`${TAB_CHANNEL_PREFIX}${menuId}`);
      tabChannel.onmessage = (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (!data || typeof data !== "object") return;
        const row = data as Partial<TabSelectionMessage>;
        if (row.type !== "shopping-selection-changed") return;
        if (row.menuId !== menuId) return;
        if (row.selfId === selfIdRef.current) return;
        scheduleRefresh();
      };
    }

    async function startRealtime() {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const token = data.session?.access_token;
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
        .channel(`shopping-cdc:${menuId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "shopping_lists",
            filter: `menu_id=eq.${menuId}`,
          },
          onMenuScoped,
        )
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
            table: "menu_dishes",
          },
          onDish,
        )
        .subscribe();
    }

    void startRealtime();

    return () => {
      cancelled = true;
      aliveRef.current = false;
      publishRef.current = null;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      tabChannel?.close();
      authSub?.unsubscribe();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [menuId, publishRef]);

  useEffect(() => {
    if (isPending || !pendingWhileBusyRef.current) return;
    pendingWhileBusyRef.current = false;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (!aliveRef.current) return;
      if (!shouldApplyRemoteShoppingRefresh(isPendingRef.current)) {
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
  }, [isPending]);

  if (!notice) return null;

  return (
    <p
      data-component="shopping-live-sync-notice"
      className="mt-2 text-sm text-muted-foreground"
      role="status"
    >
      Список обновлён
    </p>
  );
}
