-- TEAM OJAS RACING — AUTHENTICATION + SECURE RLS
-- Run AFTER the original inventory tables and the V7 temporary RLS setup.
-- This replaces public write access with authenticated role-based access.

-- =====================================================
-- 1) PROFILES / ROLES
-- =====================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'Team Member'
    check (role in ('Admin', 'Team Member', 'Viewer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Automatically create a profile whenever a new Supabase Auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'Team Member'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Helper used by RLS. SECURITY DEFINER avoids recursive policy checks.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'Admin'
  );
$$;

create or replace function public.can_write_inventory()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('Admin', 'Team Member')
  );
$$;

-- Profiles: signed-in users can see the team list; only Admins can change roles.
drop policy if exists "Profiles public read" on public.profiles;
drop policy if exists "Profiles authenticated read" on public.profiles;
drop policy if exists "Profiles admin update" on public.profiles;

create policy "Profiles authenticated read"
on public.profiles for select
to authenticated
using (true);

create policy "Profiles admin update"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (role in ('Admin', 'Team Member', 'Viewer'));

-- =====================================================
-- 2) REMOVE TEMPORARY PUBLIC INVENTORY POLICIES
-- =====================================================
drop policy if exists "Public can read categories" on public.categories;
drop policy if exists "Public can insert categories" on public.categories;
drop policy if exists "Public can update categories" on public.categories;
drop policy if exists "Public can delete categories" on public.categories;
drop policy if exists "Allow public read categories" on public.categories;
drop policy if exists "Allow public insert categories" on public.categories;
drop policy if exists "Allow public update categories" on public.categories;
drop policy if exists "Allow public delete categories" on public.categories;

drop policy if exists "Public can read parts" on public.parts;
drop policy if exists "Public can insert parts" on public.parts;
drop policy if exists "Public can update parts" on public.parts;
drop policy if exists "Public can delete parts" on public.parts;
drop policy if exists "Allow public read parts" on public.parts;
drop policy if exists "Allow public insert parts" on public.parts;
drop policy if exists "Allow public update parts" on public.parts;
drop policy if exists "Allow public delete parts" on public.parts;

alter table public.categories enable row level security;
alter table public.parts enable row level security;

create policy "Authenticated can read categories"
on public.categories for select
to authenticated
using (true);

create policy "Members can insert categories"
on public.categories for insert
to authenticated
with check (public.can_write_inventory());

create policy "Members can update categories"
on public.categories for update
to authenticated
using (public.can_write_inventory())
with check (public.can_write_inventory());

create policy "Members can delete categories"
on public.categories for delete
to authenticated
using (public.can_write_inventory());

create policy "Authenticated can read parts"
on public.parts for select
to authenticated
using (true);

create policy "Members can insert parts"
on public.parts for insert
to authenticated
with check (public.can_write_inventory());

create policy "Members can update parts"
on public.parts for update
to authenticated
using (public.can_write_inventory())
with check (public.can_write_inventory());

create policy "Members can delete parts"
on public.parts for delete
to authenticated
using (public.can_write_inventory());

-- =====================================================
-- 3) STORAGE: AUTHENTICATED TEAM ACCESS
-- =====================================================
insert into storage.buckets (id, name, public)
values ('part-images', 'part-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Public can read part images" on storage.objects;
drop policy if exists "Public can upload part images" on storage.objects;
drop policy if exists "Public can update part images" on storage.objects;
drop policy if exists "Public can delete part images" on storage.objects;
drop policy if exists "Public can read part images" on storage.objects;
drop policy if exists "Public can upload part images" on storage.objects;
drop policy if exists "Public can update part images" on storage.objects;
drop policy if exists "Public can delete part images" on storage.objects;

create policy "Authenticated can read part images"
on storage.objects for select
to authenticated
using (bucket_id = 'part-images');

create policy "Members can upload part images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'part-images' and public.can_write_inventory());

create policy "Members can update part images"
on storage.objects for update
to authenticated
using (bucket_id = 'part-images' and public.can_write_inventory())
with check (bucket_id = 'part-images' and public.can_write_inventory());

create policy "Members can delete part images"
on storage.objects for delete
to authenticated
using (bucket_id = 'part-images' and public.can_write_inventory());

-- =====================================================
-- 4) IMPORTANT: AFTER YOUR FIRST ACCOUNT IS CREATED
-- =====================================================
-- Replace the email below with the Admin's email and run this once:
-- update public.profiles p
-- set role = 'Admin'
-- from auth.users u
-- where p.id = u.id and u.email = 'YOUR-ADMIN-EMAIL@example.com';
