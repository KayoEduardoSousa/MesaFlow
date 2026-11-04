-- Close direct membership-role writes and enforce same-tenant relationships.
-- Membership onboarding is performed only through a reviewed SECURITY DEFINER RPC.

drop policy if exists "Administradores gerenciam memberships do restaurante" on public.memberships;
drop policy if exists "Administradores atualizam memberships do restaurante" on public.memberships;
-- Trusted service_role remains privileged and must never be exposed to the client.
revoke insert, update, delete, truncate on table public.memberships from public, anon, authenticated;

-- Composite parent keys let foreign keys validate restaurant ownership as well
-- as row identity. NOT VALID preserves legacy rows while enforcing new writes.
create unique index if not exists categories_restaurant_id_id_uidx
  on public.categories (restaurant_id, id);
create unique index if not exists products_restaurant_id_id_uidx
  on public.products (restaurant_id, id);
create unique index if not exists product_options_restaurant_id_id_uidx
  on public.product_options (restaurant_id, id);
create unique index if not exists dining_tables_restaurant_id_id_uidx
  on public.dining_tables (restaurant_id, id);
create unique index if not exists tabs_restaurant_id_id_uidx
  on public.tabs (restaurant_id, id);
create unique index if not exists orders_restaurant_id_id_uidx
  on public.orders (restaurant_id, id);

alter table public.products
  add constraint products_restaurant_category_fk
  foreign key (restaurant_id, category_id)
  references public.categories (restaurant_id, id)
  not valid;

alter table public.product_options
  add constraint product_options_restaurant_product_fk
  foreign key (restaurant_id, product_id)
  references public.products (restaurant_id, id)
  not valid;

alter table public.product_option_items
  add constraint product_option_items_restaurant_option_fk
  foreign key (restaurant_id, option_id)
  references public.product_options (restaurant_id, id)
  not valid;

alter table public.tabs
  add constraint tabs_restaurant_table_fk
  foreign key (restaurant_id, table_id)
  references public.dining_tables (restaurant_id, id)
  not valid;

alter table public.orders
  add constraint orders_restaurant_tab_fk
  foreign key (restaurant_id, tab_id)
  references public.tabs (restaurant_id, id)
  not valid;

alter table public.order_items
  add constraint order_items_restaurant_order_fk
  foreign key (restaurant_id, order_id)
  references public.orders (restaurant_id, id)
  not valid;

alter table public.order_items
  add constraint order_items_restaurant_product_fk
  foreign key (restaurant_id, product_id)
  references public.products (restaurant_id, id)
  not valid;

alter table public.order_events
  add constraint order_events_restaurant_order_fk
  foreign key (restaurant_id, order_id)
  references public.orders (restaurant_id, id)
  not valid;

alter table public.notifications
  add constraint notifications_restaurant_order_fk
  foreign key (restaurant_id, order_id)
  references public.orders (restaurant_id, id)
  not valid;
