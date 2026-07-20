/**
 * In-process mutex so parallel resuggest/replace on the same menu
 * cannot interleave invent→assign (last-writer races).
 * Cross-instance (multi-server) races remain possible — OK for single-operator v1.
 */

const locks = new Map<string, Promise<void>>();

export async function withMenuMutationLock<T>(
  menuId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = locks.get(menuId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    menuId,
    previous.then(() => gate),
  );
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(menuId) === gate) {
      locks.delete(menuId);
    }
  }
}
