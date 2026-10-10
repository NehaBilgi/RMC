-- CONCRETE 360 starter schema.
-- Run this migration once in Supabase SQL Editor, or apply it with the Supabase CLI.
-- Existing app pages still use browser storage until they are explicitly wired to these tables.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete restrict,
  username text not null,
  role text not null default 'READ_ONLY'
    check (role in ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'READ_ONLY')),
  page_access text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_page_access_allowed check (
    page_access <@ array[
      'dashboard', 'ongoing_site', 'billing', 'total_bill', 'site_tests', 'trips',
      'material_category', 'transit_mixer', 'concrete_pumps', 'mix_design',
      'site_report', 'measurements', 'company_details'
    ]::text[]
  )
);

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));
create index if not exists profiles_company_id_idx on public.profiles (company_id);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  name text not null,
  code text,
  client_name text not null default '',
  location text not null default '',
  status text not null default 'active'
    check (status in ('active', 'completed', 'on_hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);
create index if not exists sites_company_id_idx on public.sites (company_id);

-- Flexible starter table for feature records. A record is scoped to one company,
-- page, and optionally site. Feature services can store the existing page model
-- as JSON while the app is migrated to normalized tables over time.
create table if not exists public.app_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  site_id uuid references public.sites (id) on delete restrict,
  page_id text not null check (
    page_id in (
      'dashboard', 'ongoing_site', 'billing', 'total_bill', 'site_tests', 'trips',
      'material_category', 'transit_mixer', 'concrete_pumps', 'mix_design',
      'site_report', 'measurements', 'company_details'
    )
  ),
  record_type text not null,
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists app_records_company_page_idx
  on public.app_records (company_id, page_id, created_at desc);
create index if not exists app_records_site_page_idx
  on public.app_records (site_id, page_id);

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id
  from public.profiles as p
  where p.id = (select auth.uid())
    and p.active = true
  limit 1
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role in ('SUPER_ADMIN', 'ADMIN')
  )
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.active = true
      and p.role = 'SUPER_ADMIN'
  )
$$;

create or replace function public.has_page_access(requested_page text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.active = true
      and (
        p.role in ('SUPER_ADMIN', 'ADMIN')
        or requested_page = any (p.page_access)
      )
  )
$$;

create or replace function public.can_access_any_page()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as p
    where p.id = (select auth.uid())
      and p.active = true
      and (
        p.role in ('SUPER_ADMIN', 'ADMIN')
        or cardinality(p.page_access) > 0
      )
  )
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists sites_touch_updated_at on public.sites;
create trigger sites_touch_updated_at
  before update on public.sites
  for each row execute function public.touch_updated_at();
drop trigger if exists app_records_touch_updated_at on public.app_records;
create trigger app_records_touch_updated_at
  before update on public.app_records
  for each row execute function public.touch_updated_at();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.app_records enable row level security;

drop policy if exists "company members can view their company" on public.companies;
create policy "company members can view their company"
  on public.companies for select to authenticated
  using (id = (select public.current_company_id()));

drop policy if exists "users can view their own profile or admins can view company profiles" on public.profiles;
create policy "users can view their own profile or admins can view company profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      company_id = (select public.current_company_id())
      and (select public.is_admin())
    )
  );

drop policy if exists "admins can update profiles in their company" on public.profiles;
create policy "admins can update profiles in their company"
  on public.profiles for update to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  )
  with check (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
    and (role <> 'SUPER_ADMIN' or (select public.is_super_admin()))
  );

drop policy if exists "permitted company users can view sites" on public.sites;
create policy "permitted company users can view sites"
  on public.sites for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.can_access_any_page())
  );

drop policy if exists "admins can create company sites" on public.sites;
create policy "admins can create company sites"
  on public.sites for insert to authenticated
  with check (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  );

drop policy if exists "admins can update company sites" on public.sites;
create policy "admins can update company sites"
  on public.sites for update to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  )
  with check (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  );

drop policy if exists "admins can delete company sites" on public.sites;
create policy "admins can delete company sites"
  on public.sites for delete to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  );

drop policy if exists "users can read records for granted pages" on public.app_records;
create policy "users can read records for granted pages"
  on public.app_records for select to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.has_page_access(page_id))
  );

drop policy if exists "employees and admins can create records for granted pages" on public.app_records;
create policy "employees and admins can create records for granted pages"
  on public.app_records for insert to authenticated
  with check (
    company_id = (select public.current_company_id())
    and created_by = (select auth.uid())
    and (select public.has_page_access(page_id))
    and (
      site_id is null
      or exists (
        select 1
        from public.sites as s
        where s.id = app_records.site_id
          and s.company_id = (select public.current_company_id())
      )
    )
    and exists (
      select 1
      from public.profiles as p
      where p.id = (select auth.uid())
        and p.active = true
        and p.role in ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE')
    )
  );

drop policy if exists "only admins can update records" on public.app_records;
create policy "only admins can update records"
  on public.app_records for update to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  )
  with check (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
    and (
      site_id is null
      or exists (
        select 1
        from public.sites as s
        where s.id = app_records.site_id
          and s.company_id = (select public.current_company_id())
      )
    )
  );

drop policy if exists "only admins can delete records" on public.app_records;
create policy "only admins can delete records"
  on public.app_records for delete to authenticated
  using (
    company_id = (select public.current_company_id())
    and (select public.is_admin())
  );

revoke all on function public.current_company_id() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_super_admin() from public;
revoke all on function public.has_page_access(text) from public;
revoke all on function public.can_access_any_page() from public;
grant execute on function public.current_company_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_page_access(text) to authenticated;
grant execute on function public.can_access_any_page() to authenticated;

grant select on public.companies to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.sites to authenticated;
grant select, insert, update, delete on public.app_records to authenticated;
