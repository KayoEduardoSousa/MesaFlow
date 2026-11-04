-- MesaFlow: criação de restaurante e vínculo de proprietário
-- Esta função permite que um usuário autenticado crie seu restaurante e
-- automaticamente vire owner da operação.

create or replace function public.create_restaurant_owner(p_name text, p_slug text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_restaurant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária para criar um restaurante.';
  end if;

  if p_name is null or trim(p_name) = '' then
    raise exception 'O nome do restaurante é obrigatório.';
  end if;

  if p_slug is null or trim(p_slug) = '' then
    raise exception 'O slug do restaurante é obrigatório.';
  end if;

  insert into public.restaurants (name, slug)
  values (trim(p_name), trim(p_slug))
  returning id into v_restaurant_id;

  insert into public.profiles (id, full_name)
  values (v_user_id, trim(p_full_name))
  on conflict (id) do update set full_name = excluded.full_name;

  insert into public.memberships (restaurant_id, user_id, role, active)
  values (v_restaurant_id, v_user_id, 'owner', true)
  on conflict (restaurant_id, user_id) do update set role = 'owner', active = true;

  return v_restaurant_id;
end;
$$;

grant execute on function public.create_restaurant_owner(text, text, text) to authenticated;
