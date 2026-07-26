import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Serializes invent→assign for one menu:
 * 1) in-process queue (same Next instance)
 * 2) Postgres lease via try_acquire_menu_mutation_lock (cross-instance)
 *
 * Acquire uses pg_advisory_xact_lock inside a short RPC, then inserts a lease
 * row that survives pooled PostgREST round-trips until release / TTL.
 */

const locks = new Map<string, Promise<void>>();

const ACQUIRE_RETRY_MS = 80;
const ACQUIRE_RETRY_MAX_MS = 800;
const ACQUIRE_TIMEOUT_MS = 10 * 60_000;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireDbLease(
  supabase: SupabaseClient,
  menuId: string,
): Promise<string> {
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;
  let delay = ACQUIRE_RETRY_MS;
  for (;;) {
    const { data, error } = await supabase.rpc(
      "try_acquire_menu_mutation_lock",
      { p_menu_id: menuId },
    );
    if (error) {
      throw new Error(error.message || "Не удалось взять блокировку меню.");
    }
    if (typeof data === "string" && data.length > 0) return data;
    if (Date.now() >= deadline) {
      throw new Error("Меню занято другой операцией. Попробуйте снова.");
    }
    await sleep(delay);
    delay = Math.min(delay * 2, ACQUIRE_RETRY_MAX_MS);
  }
}

async function releaseDbLease(
  supabase: SupabaseClient,
  menuId: string,
  token: string,
): Promise<void> {
  const { error } = await supabase.rpc("release_menu_mutation_lock", {
    p_menu_id: menuId,
    p_token: token,
  });
  if (error) {
    console.error("release_menu_mutation_lock failed", error.message);
  }
}

async function withInProcessQueue<T>(
  menuId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(menuId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(menuId, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(menuId) === tail) {
      locks.delete(menuId);
    }
  }
}

export async function withMenuMutationLock<T>(
  supabase: SupabaseClient,
  menuId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withInProcessQueue(menuId, async () => {
    const token = await acquireDbLease(supabase, menuId);
    try {
      return await fn();
    } finally {
      await releaseDbLease(supabase, menuId, token);
    }
  });
}
