export type MembershipRestaurantRole = "owner" | "admin" | "waiter" | "kitchen";

export type MembershipRestaurantRow = {
  restaurant_id: string;
  role: MembershipRestaurantRole;
  created_at?: string;
  restaurants: {
    id: string;
    name: string;
    slug: string;
    created_at: string;
  } | Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
  }> | null;
};

export type RestaurantMembershipView = {
  id: string;
  name: string;
  slug: string;
  role: MembershipRestaurantRole;
  createdAt: string;
};

export function mapMembershipRestaurants(
  rows: readonly MembershipRestaurantRow[],
): RestaurantMembershipView[] {
  return [...rows]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .flatMap((row) => {
    const restaurant = Array.isArray(row.restaurants) ? row.restaurants[0] : row.restaurants;
    if (!restaurant || restaurant.id !== row.restaurant_id) return [];

    return [{
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      role: row.role,
      createdAt: restaurant.created_at,
    }];
    });
}
