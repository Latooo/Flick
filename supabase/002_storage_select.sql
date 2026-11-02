-- Borrar o reemplazar fotos desde el panel (storage remove / upload con upsert) necesita
-- poder LEER las filas de storage.objects. Solo admins y solo el bucket 'productos'.
-- Idempotente. Se corre a mano en el SQL Editor.

drop policy if exists "productos_storage_select" on storage.objects;
create policy "productos_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'productos' and public.is_admin());
