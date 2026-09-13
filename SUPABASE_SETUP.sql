-- TEAM OJAS RACING — STORAGE + RLS SETUP
-- Run this in Supabase SQL Editor after the inventory tables were created.

-- 1) Create a public bucket for part images.
insert into storage.buckets (id, name, public)
values ('part-images', 'part-images', true)
on conflict (id) do update set public = true;

-- 2) Temporary prototype policies.
-- These allow the browser app to work without login.
-- We will replace these with authenticated team roles when login is added.

alter table public.categories enable row level security;
alter table public.parts enable row level security;

drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can insert categories" on public.categories;
drop policy if exists "Public can update categories" on public.categories;
drop policy if exists "Public can delete categories" on public.categories;

create policy "Public can read categories" on public.categories for select to anon, authenticated using (true);
create policy "Public can insert categories" on public.categories for insert to anon, authenticated with check (true);
create policy "Public can update categories" on public.categories for update to anon, authenticated using (true) with check (true);
create policy "Public can delete categories" on public.categories for delete to anon, authenticated using (true);

drop policy if exists "Public can read parts" on public.parts;
drop policy if exists "Public can insert parts" on public.parts;
drop policy if exists "Public can update parts" on public.parts;
drop policy if exists "Public can delete parts" on public.parts;

create policy "Public can read parts" on public.parts for select to anon, authenticated using (true);
create policy "Public can insert parts" on public.parts for insert to anon, authenticated with check (true);
create policy "Public can update parts" on public.parts for update to anon, authenticated using (true) with check (true);
create policy "Public can delete parts" on public.parts for delete to anon, authenticated using (true);

-- 3) Storage policies for the public part-images bucket.
drop policy if exists "Public can read part images" on storage.objects;
drop policy if exists "Public can upload part images" on storage.objects;
drop policy if exists "Public can update part images" on storage.objects;
drop policy if exists "Public can delete part images" on storage.objects;

create policy "Public can read part images" on storage.objects
for select to anon, authenticated
using (bucket_id = 'part-images');

create policy "Public can upload part images" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'part-images');

create policy "Public can update part images" on storage.objects
for update to anon, authenticated
using (bucket_id = 'part-images')
with check (bucket_id = 'part-images');

create policy "Public can delete part images" on storage.objects
for delete to anon, authenticated
using (bucket_id = 'part-images');
