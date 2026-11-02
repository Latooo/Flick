-- Flick: esquema, permisos y storage. Idempotente: se puede correr varias veces.
-- Los admins se agregan a mano en el SQL Editor:
--   insert into public.admins (user_id) values ('<uuid de auth.users>');

-- ---------- tablas ----------

create table if not exists public.productos (
  id               text primary key check (id ~ '^[a-z0-9-]+$'),
  nombre           text not null,
  marca            text not null,
  categoria        text not null,
  destacado        boolean not null default false,
  agotado          boolean not null default false,
  colores          text[] not null default '{}',
  gancho           text not null,
  descripcion      text not null,
  -- json y no jsonb: jsonb reordena las claves y cambiaria el orden de la tabla de specs del modal
  specs            json not null default '{}',
  nota_honesta     text null,
  fotos            text[] not null,
  tiene_fotos      boolean not null default true,
  placeholder      text not null,
  precio           integer null check (precio > 0),
  precio_regular   integer null check (precio_regular > 0),
  activo           boolean not null default true,
  orden            integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

-- ---------- updated_at ----------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_set_updated_at on public.productos;
create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- ---------- is_admin() ----------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- RLS ----------

alter table public.productos enable row level security;
alter table public.admins enable row level security;

drop policy if exists "productos_select" on public.productos;
create policy "productos_select" on public.productos
  for select to anon, authenticated
  using (activo or public.is_admin());

drop policy if exists "productos_insert" on public.productos;
create policy "productos_insert" on public.productos
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "productos_update" on public.productos;
create policy "productos_update" on public.productos
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "productos_delete" on public.productos;
create policy "productos_delete" on public.productos
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "admins_select" on public.admins;
create policy "admins_select" on public.admins
  for select to authenticated
  using (user_id = auth.uid());

-- ---------- GRANTs (el proyecto no expone tablas nuevas automaticamente) ----------

grant usage on schema public to anon, authenticated;
grant select on public.productos to anon, authenticated;
grant insert, update, delete on public.productos to authenticated;
grant select on public.admins to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 2097152, array['image/jpeg'])
on conflict do nothing;

drop policy if exists "productos_storage_insert" on storage.objects;
create policy "productos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_storage_update" on storage.objects;
create policy "productos_storage_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.is_admin())
  with check (bucket_id = 'productos' and public.is_admin());

drop policy if exists "productos_storage_delete" on storage.objects;
create policy "productos_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.is_admin());
