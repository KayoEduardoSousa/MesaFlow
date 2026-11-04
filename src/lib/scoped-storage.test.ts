import { describe, expect, it } from "vitest";
import { isScopedStorageOwnerReady, readScopedStorage, scopedStorageKey, writeScopedStorage } from "./scoped-storage";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("scoped local storage", () => {
  it("keeps data under distinct keys for each authenticated user", () => {
    const storage = new MemoryStorage();
    writeScopedStorage(storage, "user-a", { records: ["A"] });

    expect(readScopedStorage(storage, "user-a", { records: [] })).toEqual({ records: ["A"] });
    expect(readScopedStorage(storage, "user-b", { records: [] })).toEqual({ records: [] });
    expect(scopedStorageKey(null)).not.toBe(scopedStorageKey("user-a"));
  });

  it("allows persistence only after the current user's scope has loaded", () => {
    expect(isScopedStorageOwnerReady(false, "user-a", "user-b")).toBe(false);
    expect(isScopedStorageOwnerReady(true, "user-a", "user-b")).toBe(false);
    expect(isScopedStorageOwnerReady(true, "user-b", "user-b")).toBe(true);
  });

  it("returns the fallback for invalid stored JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(scopedStorageKey("user-a"), "not-json");

    expect(readScopedStorage(storage, "user-a", { records: [] })).toEqual({ records: [] });
  });
});
