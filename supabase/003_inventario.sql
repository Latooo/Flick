-- Flick: seguimiento de inventario (reemplaza seguimiento-inventario.xlsx).
-- Idempotente: se puede correr varias veces. Requiere schema.sql (usa public.is_admin()).
-- Los datos (costos, ventas) NO van en el repo: el repo es público. El seed se corre aparte.
--
-- Una fila por unidad, como la hoja Inventario del Excel. Lo calculado (utilidad, margen,
-- días) vive en las vistas, no en la tabla. Solo admins leen y escriben: costos y márgenes
-- nunca pueden quedar públicos, así que anon no recibe ningún permiso.

-- ---------- tablas ----------

create table if not exists public.inventario (
  id                bigint generated always as identity primary key,
  modelo            text not null check (length(btrim(modelo)) > 0),
  marca             text null,
  color             text null,
  pedido            text null,                -- "Pedido 1", "Pedido 2"...; el detalle (PO) va en notas
  producto_id       text null references public.productos (id) on delete set null,
  costo             integer not null check (costo >= 0),   -- costo REAL pagado, con cupón
  fecha_pedido      date null,
  fecha_llegada     date null,
  estado_llegada    text null check (estado_llegada in ('OK', 'Defectuoso', 'Faltante', 'Dañado en tránsito')),
  fecha_publicacion date null,
  precio_publicado  integer null check (precio_publicado > 0),
  consultas         integer not null default 0 check (consultas >= 0),
  fecha_venta       date null,
  precio_final      integer null check (precio_final >= 0),
  costo_domicilio   integer null check (costo_domicilio >= 0),   -- null = no se registró
  canal             text null check (canal in ('Marketplace', 'Instagram', 'WhatsApp', 'TikTok', 'Conocido', 'Discord')),
  combo             boolean not null default false,
  notas             text null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid null default auth.uid(),
  updated_by        uuid null default auth.uid(),
  -- vendida = tiene fecha y precio final; uno sin el otro es un error de captura
  constraint inventario_venta_completa check ((fecha_venta is null) = (precio_final is null))
);

create index if not exists inventario_modelo_idx on public.inventario (modelo);
create index if not exists inventario_producto_idx on public.inventario (producto_id);

create table if not exists public.gastos (
  id          bigint generated always as identity primary key,
  fecha       date not null,
  concepto    text not null check (length(btrim(concepto)) > 0),
  monto       integer not null check (monto > 0),
  pedido      text null,
  notas       text null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid null default auth.uid(),
  updated_by  uuid null default auth.uid()
);

-- ---------- quién tocó qué ----------

create or replace function public.set_updated_meta()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists inventario_set_updated on public.inventario;
create trigger inventario_set_updated
  before update on public.inventario
  for each row execute function public.set_updated_meta();

drop trigger if exists gastos_set_updated on public.gastos;
create trigger gastos_set_updated
  before update on public.gastos
  for each row execute function public.set_updated_meta();

-- ---------- vistas (security_invoker: respetan el RLS de quien consulta) ----------

-- "hoy" en Bogotá: la base corre en UTC y después de las 7 p. m. ya sería mañana
create or replace function public.hoy_bogota()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Bogota')::date $$;

-- Hoja Inventario con sus columnas grises
create or replace view public.inventario_calc
with (security_invoker = true) as
select
  i.*,
  (i.fecha_venta is null) as en_stock,
  case when i.precio_final is null then null
       else i.precio_final - i.costo - coalesce(i.costo_domicilio, 0) end as utilidad,
  case when coalesce(i.precio_final, 0) = 0 then null
       else round((i.precio_final - i.costo - coalesce(i.costo_domicilio, 0))::numeric / i.precio_final, 4) end as margen,
  -- el reloj de rotación corre desde la publicación (igual que el Excel)
  case when i.fecha_publicacion is null then null
       else coalesce(i.fecha_venta, public.hoy_bogota()) - i.fecha_publicacion end as dias_inventario,
  -- y aparte desde la llegada, para que lo no publicado no esconda capital quieto
  case when i.fecha_llegada is null then null
       else coalesce(i.fecha_venta, public.hoy_bogota()) - i.fecha_llegada end as dias_desde_llegada
from public.inventario i;

-- Hoja "Resumen por modelo". Margen meta del precio objetivo: 40% (regla rápida del negocio).
create or replace view public.inventario_resumen
with (security_invoker = true) as
with m as (
  select
    modelo,
    min(marca) as marca,
    count(*)::int                                      as unidades,
    count(*) filter (where not en_stock)::int          as vendidas,
    count(*) filter (where en_stock)::int              as en_stock,
    sum(costo)::bigint                                 as inversion,
    coalesce(sum(precio_final), 0)::bigint             as ingresos,
    coalesce(sum(utilidad), 0)::bigint                 as utilidad,
    sum(consultas)::int                                as consultas,
    round(avg(dias_inventario) filter (where not en_stock), 1) as dias_prom_venta,
    max(dias_desde_llegada) filter (where en_stock)    as max_dias_en_bodega
  from public.inventario_calc
  group by modelo
)
select
  m.*,
  case when m.ingresos = 0 then null else round(m.utilidad::numeric / m.ingresos, 4) end as margen,
  case
    when m.vendidas = 0 then 'Sin datos aún'
    when m.dias_prom_venta <= 30 and m.ingresos > 0 and m.utilidad::numeric / m.ingresos >= 0.4 then 'REPONER — sube cantidad'
    when m.dias_prom_venta <= 60 then 'Reponer igual cantidad'
    else 'NO reponer — rota lento'
  end as veredicto,
  (round((m.inversion::numeric / m.unidades) / (1 - 0.40) / 500) * 500)::int as precio_objetivo
from m;

-- Totales del Resumen
create or replace view public.inventario_totales
with (security_invoker = true) as
select
  t.*,
  case when t.inversion = 0 then null else round(t.utilidad::numeric / t.inversion, 4) end as roi,
  t.utilidad - t.gastos as utilidad_despues_gastos
from (
  select
    count(*)::int                                        as unidades,
    count(*) filter (where not en_stock)::int            as vendidas,
    count(*) filter (where en_stock)::int                as en_stock,
    coalesce(sum(costo), 0)::bigint                      as inversion,
    coalesce(sum(precio_final), 0)::bigint               as ingresos,
    coalesce(sum(utilidad), 0)::bigint                   as utilidad,
    coalesce(sum(costo) filter (where en_stock), 0)::bigint as capital_inmovilizado,
    (select coalesce(sum(monto), 0) from public.gastos)::bigint as gastos
  from public.inventario_calc
) t;

-- ---------- RLS: solo admins ----------

alter table public.inventario enable row level security;
alter table public.gastos enable row level security;

drop policy if exists "inventario_admin" on public.inventario;
create policy "inventario_admin" on public.inventario
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "gastos_admin" on public.gastos;
create policy "gastos_admin" on public.gastos
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------- GRANTs: authenticated sí (el RLS filtra a los admins), anon nada ----------

revoke all on public.inventario, public.gastos from anon;
revoke all on public.inventario_calc, public.inventario_resumen, public.inventario_totales from anon;
revoke all on function public.hoy_bogota() from public, anon;   -- las funciones nacen ejecutables por PUBLIC

grant select, insert, update, delete on public.inventario, public.gastos to authenticated;
grant select on public.inventario_calc, public.inventario_resumen, public.inventario_totales to authenticated;
grant execute on function public.hoy_bogota() to authenticated;
