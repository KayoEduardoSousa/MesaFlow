import { describe, expect, it } from "vitest";
import { awaitForSession } from "./session-fence";

describe("session result fence", () => {
  it("marks a result stale when the signed-in user changes before completion", async () => {
    let currentUserId: string | null = "user-a";
    let resolveRequest!: (value: string) => void;
    const request = new Promise<string>((resolve) => {
      resolveRequest = resolve;
    });

    const resultPromise = awaitForSession("user-a", () => currentUserId, () => request);
    currentUserId = "user-b";
    resolveRequest("restaurant-created-for-a");

    await expect(resultPromise).resolves.toEqual({
      isCurrent: false,
      value: "restaurant-created-for-a",
    });
  });

  it("keeps a result current when the same user remains signed in", async () => {
    await expect(awaitForSession("user-a", () => "user-a", async () => "ok"))
      .resolves.toEqual({ isCurrent: true, value: "ok" });
  });
});
