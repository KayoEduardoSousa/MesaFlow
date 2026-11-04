-- MesaFlow: baseline de segurança e isolamento multi-tenant
-- Requisitos: habilitar RLS e validar associação do usuário ao restaurante.

alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.dining_tables enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_items enable row level security;
alter table public.tabs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.notifications enable row level security;

create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id
  from public.memberships
  where user_id = auth.uid()
    and active = true
  order by created_at desc
  limit 1;
$$;

create or replace function public.is_restaurant_member(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
      and m.active = true
  );
$$;

create or replace function public.is_restaurant_admin(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.restaurant_id = p_restaurant_id
      and m.user_id = auth.uid()
      and m.active = true
      and m.role in ('owner', 'admin')
  );
$$;

create policy "Restaurantes visíveis apenas ao membro"
on public.restaurants
for select
using (
  public.is_restaurant_member(id)
);

create policy "Perfil do próprio usuário pode ser lido"
on public.profiles
for select
using (id = auth.uid());

create policy "Membros do restaurante vêem associações do restaurante"
on public.memberships
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam memberships do restaurante"
on public.memberships
for insert
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Administradores atualizam memberships do restaurante"
on public.memberships
for update
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Mesas visíveis apenas ao restaurante"
on public.dining_tables
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam mesas do restaurante"
on public.dining_tables
for insert
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Administradores atualizam mesas do restaurante"
on public.dining_tables
for update
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Categorias visíveis ao restaurante"
on public.categories
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam categorias do restaurante"
on public.categories
for all
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Produtos visíveis ao restaurante"
on public.products
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam produtos do restaurante"
on public.products
for all
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Opções visíveis ao restaurante"
on public.product_options
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam opções do restaurante"
on public.product_options
for all
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Itens de opção visíveis ao restaurante"
on public.product_option_items
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Administradores gerenciam itens de opção do restaurante"
on public.product_option_items
for all
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_admin(restaurant_id)
);

create policy "Abas visíveis ao restaurante"
on public.tabs
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Garçons e administradores gerenciam comandas do restaurante"
on public.tabs
for all
using (
  public.is_restaurant_admin(restaurant_id)
  or (
    auth.uid() = opened_by
    and public.is_restaurant_member(restaurant_id)
  )
)
with check (
  public.is_restaurant_member(restaurant_id)
);

create policy "Pedidos visíveis ao restaurante"
on public.orders
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Garçons e administradores criam pedidos do restaurante"
on public.orders
for insert
with check (
  public.is_restaurant_member(restaurant_id)
  and created_by = auth.uid()
);

create policy "Atualizações de pedidos restritas ao restaurante"
on public.orders
for update
using (
  public.is_restaurant_admin(restaurant_id)
  or created_by = auth.uid()
)
with check (
  public.is_restaurant_member(restaurant_id)
);

create policy "Itens de pedidos visíveis ao restaurante"
on public.order_items
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Itens de pedido criados por usuários do restaurante"
on public.order_items
for insert
with check (
  public.is_restaurant_member(restaurant_id)
);

create policy "Itens de pedido atualizados dentro do restaurante"
on public.order_items
for update
using (
  public.is_restaurant_admin(restaurant_id)
)
with check (
  public.is_restaurant_member(restaurant_id)
);

create policy "Eventos do restaurante visíveis ao restaurante"
on public.order_events
for select
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "Eventos de pedido criados por usuários do restaurante"
on public.order_events
for insert
with check (
  public.is_restaurant_member(restaurant_id)
);

create policy "Notificações visíveis ao destinatário e ao restaurante"
on public.notifications
for select
using (
  user_id = auth.uid()
  or public.is_restaurant_admin(restaurant_id)
);

create policy "Notificações geradas dentro do restaurante"
on public.notifications
for insert
with check (
  public.is_restaurant_member(restaurant_id)
  and user_id = auth.uid()
);

create policy "Usuário pode atualizar suas notificações"
on public.notifications
for update
using (
  user_id = auth.uid()
  or public.is_restaurant_admin(restaurant_id)
)
with check (
  user_id = auth.uid()
  or public.is_restaurant_admin(restaurant_id)
);
