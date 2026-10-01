do $types$
begin
  create type public.member_role as enum ('owner', 'manager', 'viewer');
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');
exception
  when duplicate_object then null;
end;
$types$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  city text not null default 'Abidjan',
  subscription_status public.subscription_status not null default 'trialing',
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.member_role not null default 'manager',
  created_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create index if not exists memberships_organization_user_idx
  on public.memberships (organization_id, user_id);

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;

revoke all on public.organizations, public.memberships from public, anon, authenticated;
grant select, update on public.organizations to authenticated;
grant select on public.memberships to authenticated;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
  );
$function$;

create or replace function public.is_org_owner(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'::public.member_role
  );
$function$;

create or replace function public.can_write_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.memberships as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in (
        'owner'::public.member_role,
        'manager'::public.member_role
      )
  );
$function$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.is_org_owner(uuid) from public, anon;
revoke all on function public.can_write_org(uuid) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_owner(uuid) to authenticated;
grant execute on function public.can_write_org(uuid) to authenticated;

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select
  on public.organizations for select to authenticated
  using (public.is_org_member(id));

drop policy if exists organizations_owner_update on public.organizations;
create policy organizations_owner_update
  on public.organizations for update to authenticated
  using (public.is_org_owner(id))
  with check (public.is_org_owner(id));

drop policy if exists memberships_member_select on public.memberships;
create policy memberships_member_select
  on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or public.is_org_member(organization_id));

create or replace function public.create_organization_with_owner(
  p_name text,
  p_phone text default null,
  p_email text default null,
  p_city text default 'Abidjan'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_name is null
    or pg_catalog.length(pg_catalog.btrim(p_name)) < 2
    or pg_catalog.length(pg_catalog.btrim(p_name)) > 120
  then
    raise exception 'Invalid organization name' using errcode = '22023';
  end if;

  if pg_catalog.length(coalesce(p_phone, '')) > 30
    or pg_catalog.length(coalesce(p_email, '')) > 120
    or pg_catalog.length(coalesce(p_city, '')) > 80
  then
    raise exception 'Invalid organization contact details' using errcode = '22023';
  end if;

  insert into public.organizations (name, phone, email, city)
  values (
    pg_catalog.btrim(p_name),
    nullif(pg_catalog.btrim(p_phone), ''),
    p_email,
    coalesce(nullif(pg_catalog.btrim(p_city), ''), 'Abidjan')
  )
  returning id into v_organization_id;

  insert into public.memberships (user_id, organization_id, role)
  values (v_user_id, v_organization_id, 'owner'::public.member_role);

  return v_organization_id;
end;
$function$;

revoke all on function public.create_organization_with_owner(text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_organization_with_owner(text, text, text, text)
  to authenticated;