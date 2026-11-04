import { describe, expect, it } from "vitest";
import { withoutLegacyUsers } from "./legacy-storage";

describe("withoutLegacyUsers", () => {
  it("removes legacy user records without changing other restaurant data", () => {
    const oldData = {
      users: [{ email: "owner@example.com", password: "old-plaintext-password" }],
      restaurants: [{ id: "restaurant-1" }],
    };

    expect(withoutLegacyUsers(oldData)).toEqual({
      restaurants: [{ id: "restaurant-1" }],
    });
  });
});
