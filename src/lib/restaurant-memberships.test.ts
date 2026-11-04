import { describe, expect, it } from "vitest";
import { mapMembershipRestaurants } from "./restaurant-memberships";

describe("mapMembershipRestaurants", () => {
  it("maps only active-style membership relations to restaurant views", () => {
    expect(mapMembershipRestaurants([{
      restaurant_id: "restaurant-1",
      role: "owner",
      restaurants: {
        id: "restaurant-1",
        name: "Mesa Verde",
        slug: "mesa-verde",
        created_at: "2026-11-04T10:00:00.000Z",
      },
    }])).toEqual([{
      id: "restaurant-1",
      name: "Mesa Verde",
      slug: "mesa-verde",
      role: "owner",
      createdAt: "2026-11-04T10:00:00.000Z",
    }]);
  });

  it("skips memberships whose restaurant relationship is unavailable", () => {
    expect(mapMembershipRestaurants([{
      restaurant_id: "missing",
      role: "waiter",
      restaurants: null,
    }])).toEqual([]);
  });

  it("accepts a nested restaurant relationship returned as an array", () => {
    expect(mapMembershipRestaurants([{
      restaurant_id: "restaurant-1",
      role: "admin",
      restaurants: [{
        id: "restaurant-1",
        name: "Mesa Verde",
        slug: "mesa-verde",
        created_at: "2026-11-04T10:00:00.000Z",
      }],
    }])).toHaveLength(1);
  });

  it("sorts by the membership timestamp, newest first", () => {
    const rows = [
      { restaurant_id: "older", role: "waiter" as const, created_at: "2026-01-01", restaurants: { id: "older", name: "Old", slug: "old", created_at: "2026-01-01" } },
      { restaurant_id: "newer", role: "owner" as const, created_at: "2026-02-01", restaurants: { id: "newer", name: "New", slug: "new", created_at: "2026-02-01" } },
    ];

    expect(mapMembershipRestaurants(rows).map((restaurant) => restaurant.id)).toEqual(["newer", "older"]);
  });
});
