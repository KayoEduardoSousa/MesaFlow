-- MesaFlow: primeira estrutura multi-tenant.
-- Execute no SQL Editor de um projeto Supabase novo.
-- Esta migração prepara a estrutura; os fluxos de login e políticas serão
-- refinados e testados nas próximas etapas.

create extension if not exists pgcrypto;

create type public.membership_role as enum ('owner', 'admin', 'waiter', 'kitchen');
create type public.product_status as enum ('active', 'inactive', 'unavailable');
create type public.tab_status as enum ('open', 'closed', 'cancelled');
create type public.order_status as enum ('pending', 'preparing', 'ready', 'delivered', 'cancelled');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.membership_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  qr_token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  image_path text,
  status public.product_status not null default 'active',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  required boolean not null default false,
  min_selections integer not null default 0 check (min_selections >= 0),
  max_selections integer not null default 1 check (max_selections >= min_selections),
  created_at timestamptz not null default now()
);

create table public.product_option_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  name text not null,
  price_delta_cents integer not null default 0,
  active boolean not null default true
);

create table public.tabs (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.dining_tables(id),
  opened_by uuid not null references public.profiles(id),
  status public.tab_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  tab_id uuid not null references public.tabs(id),
  created_by uuid not null references public.profiles(id),
  order_number bigint generated always as identity,
  status public.order_status not null default 'pending',
  kitchen_notes text,
  sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  notes text,
  selected_options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index memberships_user_restaurant_idx on public.memberships(user_id, restaurant_id);
create index products_restaurant_category_idx on public.products(restaurant_id, category_id);
create index tabs_restaurant_status_idx on public.tabs(restaurant_id, status);
create index orders_restaurant_status_sent_idx on public.orders(restaurant_id, status, sent_at desc);
create index orders_created_by_idx on public.orders(created_by, sent_at desc);
create index order_items_order_idx on public.order_items(order_id);
create index notifications_user_unread_idx on public.notifications(user_id, read_at) where read_at is null;

-- RLS será habilitado com políticas testadas na próxima migração.
-- Não exponha tabelas ao cliente até aplicar as políticas de segurança.
