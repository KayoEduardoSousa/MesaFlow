type ScopedStorage = Pick<Storage, "getItem" | "setItem">;

const STORAGE_PREFIX = "mesaflow-demo-v2";

export function isScopedStorageOwnerReady(
  isLoaded: boolean,
  loadedUserId: string | null,
  currentUserId: string | null,
): boolean {
  return isLoaded && loadedUserId === currentUserId;
}

export function scopedStorageKey(userId: string | null): string {
  return userId ? `${STORAGE_PREFIX}:user:${userId}` : `${STORAGE_PREFIX}:guest`;
}

export function readScopedStorage<T>(
  storage: Pick<ScopedStorage, "getItem">,
  userId: string | null,
  fallback: T,
): T {
  try {
    const value = storage.getItem(scopedStorageKey(userId));
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeScopedStorage<T>(
  storage: Pick<ScopedStorage, "setItem">,
  userId: string | null,
  value: T,
): void {
  storage.setItem(scopedStorageKey(userId), JSON.stringify(value));
}
