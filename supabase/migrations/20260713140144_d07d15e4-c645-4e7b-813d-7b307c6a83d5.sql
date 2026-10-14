
create policy "app upload own folder" on storage.objects for insert
  with check (bucket_id='applications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app read own folder" on storage.objects for select
  using (bucket_id='applications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "app staff read all" on storage.objects for select
  using (bucket_id='applications' and public.is_staff(auth.uid()));
