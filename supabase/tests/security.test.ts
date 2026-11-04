import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const migrationDir = resolve(process.cwd(), "supabase/migrations");
let database: PGlite | undefined;

async function createDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant usage on schema public to anon, authenticated;
    alter default privileges in schema public
      grant select, insert, update, delete, truncate on tables to public, anon, authenticated;
    alter default privileges in schema public
      grant usage, select on sequences to anon, authenticated;
  `);

  for (const name of [
    "001_initial_schema.sql",
    "002_security_baseline.sql",
    "003_auth_restaurant_setup.sql",
    "004_membership_tenant_integrity.sql",
  ]) {
    const migration = await readFile(resolve(migrationDir, name), "utf8");
    // PGlite has gen_random_uuid() in core but does not bundle the pgcrypto extension.
    await db.exec(migration.replace(/create extension if not exists pgcrypto;?/i, ""));
  }
  return db;
}

async function seedRestaurants(db: PGlite) {
  await db.exec(`
    insert into auth.users (id) values
      ('00000000-0000-0000-0000-000000000001'),
      ('00000000-0000-0000-0000-000000000002');
    insert into public.profiles (id, full_name) values
      ('00000000-0000-0000-0000-000000000001', 'Admin One'),
      ('00000000-0000-0000-0000-000000000002', 'Waiter Two');
    insert into public.restaurants (id, name, slug) values
      ('10000000-0000-0000-0000-000000000001', 'Restaurant One', 'restaurant-one'),
      ('10000000-0000-0000-0000-000000000002', 'Restaurant Two', 'restaurant-two');
    insert into public.memberships (restaurant_id, user_id, role) values
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
      ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'waiter'),
      ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'owner');
    insert into public.categories (id, restaurant_id, name) values
      ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'One'),
      ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Two');
  `);
}

afterEach(async () => {
  await database?.close();
  database = undefined;
});

describe("Supabase security migrations", () => {
  it("prevents an admin from promoting memberships through direct table writes", async () => {
    database = await createDatabase();
    await seedRestaurants(database);

    await database.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    `);

    await expect(database.query(`
      update public.memberships
      set role = 'owner'
      where restaurant_id = '10000000-0000-0000-0000-000000000001'
        and user_id = '00000000-0000-0000-0000-000000000001'
    `)).rejects.toThrow();

    await expect(database.query(`
      insert into public.memberships (restaurant_id, user_id, role)
      values ('10000000-0000-0000-0000-000000000001',
              '00000000-0000-0000-0000-000000000002', 'owner')
    `)).rejects.toThrow();
    await expect(database.exec("truncate public.memberships")).rejects.toThrow();
  });

  it("still allows the controlled owner-onboarding RPC", async () => {
    database = await createDatabase();
    await seedRestaurants(database);
    await database.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    `);

    await expect(database.query(
      `select public.create_restaurant_owner($1, $2, $3)`,
      ["Spoofed Name", "restaurant-one", "Admin One"],
    )).rejects.toThrow();
    const existingMembership = await database.query<{ role: string }>(`
      select role::text as role from public.memberships
      where restaurant_id = '10000000-0000-0000-0000-000000000001'
        and user_id = '00000000-0000-0000-0000-000000000001'
    `);
    expect(existingMembership.rows).toEqual([{ role: "admin" }]);

    const created = await database.query<{ restaurant_id: string }>(
      `select public.create_restaurant_owner($1, $2, $3) as restaurant_id`,
      ["New Restaurant", "new-restaurant", "Admin One"],
    );
    expect(created.rows[0].restaurant_id).toMatch(/^[0-9a-f-]{36}$/i);
    const membership = await database.query<{ role: string }>(
      `select role::text as role from public.memberships where restaurant_id = $1`,
      [created.rows[0].restaurant_id],
    );
    expect(membership.rows).toEqual([{ role: "owner" }]);
  });

  it("keeps restaurant reads isolated by the authenticated user", async () => {
    database = await createDatabase();
    await seedRestaurants(database);
    await database.exec(`
      set role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
    `);

    const result = await database.query(`select id from public.restaurants order by id`);
    expect(result.rows).toEqual([{ id: "10000000-0000-0000-0000-000000000001" }]);
  });

  it("rejects a product that references another restaurant's category", async () => {
    database = await createDatabase();
    await seedRestaurants(database);

    await expect(database.query(`
      insert into public.products (restaurant_id, category_id, name, price_cents)
      values ('10000000-0000-0000-0000-000000000001',
              '20000000-0000-0000-0000-000000000002', 'Cross-tenant', 100)
    `)).rejects.toThrow();
  });
});
