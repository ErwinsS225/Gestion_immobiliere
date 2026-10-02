-- ===========================================================================
-- LOCAGEST CI - Migrations 1 a 3
-- A coller dans Supabase > SQL Editor > New query > Run
--
-- Sources de verite (dans l'ordre) :
--   supabase/migrations/20261001000000_create_organization_with_owner.sql
--   supabase/migrations/20261001000100_create_business_schema.sql
--   supabase/migrations/20261001000200_add_property_taxonomy.sql
--   supabase/migrations/20261001000300_add_inventory_and_inspection.sql
--   supabase/migrations/20261001000400_seed_inventory_catalog.sql
--   supabase/migrations/20261001000500_add_lease_prorata_settings.sql
--
-- Chaque migration est idempotente : le script peut etre relance sans risque.
--
-- ETAPE 1 - verifier que rien n existe encore, ou que la migration 1 est posee.
-- Cette requete doit renvoyer 0 sur une base vierge, ou 2 si la migration 1
-- a deja ete appliquee.
select count(*) as "migrations prealables (attendu 0 ou 2)"
from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'memberships');

-- ===========================================================================

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
-- Migration 2 : schema metier (patrimoine, baux, echeances, paiements).
-- Depend de 20261001000000_create_organization_with_owner.sql
-- (enums member_role / subscription_status, tables organizations + memberships,
--  fonctions de politique is_org_member / is_org_owner / can_write_org).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $types$
begin
  create type public.unit_type as enum ('apartment', 'shop', 'office', 'parking', 'land');
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.unit_status as enum ('vacant', 'occupied');
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.lease_status as enum ('active', 'terminated');
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.rent_call_status as enum ('pending', 'partial', 'paid', 'overdue');
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.payment_method as enum (
    'wave',
    'orange_money',
    'mtn',
    'moov',
    'cash',
    'bank_transfer'
  );
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.subscription_payment_status as enum ('pending', 'paid', 'failed', 'refunded');
exception
  when duplicate_object then null;
end;
$types$;

-- ---------------------------------------------------------------------------
-- profiles : une ligne par utilisateur Auth, creee a l'inscription.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- owners : proprietaires de biens (facultatif sur une propriete).
-- ---------------------------------------------------------------------------

create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  id_document text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owners_full_name_length check (
    pg_catalog.length(pg_catalog.btrim(full_name)) between 2 and 120
  )
);

create index if not exists owners_organization_idx on public.owners (organization_id);

-- ---------------------------------------------------------------------------
-- properties : immeubles, villas, residences.
-- ---------------------------------------------------------------------------

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references public.owners(id) on delete set null,
  name text not null,
  address text,
  commune text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_name_length check (
    pg_catalog.length(pg_catalog.btrim(name)) between 2 and 120
  )
);

create index if not exists properties_organization_idx on public.properties (organization_id);

-- ---------------------------------------------------------------------------
-- units : lots louables a l'interieur d'une propriete.
-- ---------------------------------------------------------------------------

create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  unit_type public.unit_type not null default 'apartment',
  surface_area numeric(12, 2),
  room_count smallint,
  base_rent numeric(12, 2) not null default 0,
  charges numeric(12, 2) not null default 0,
  status public.unit_status not null default 'vacant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_label_length check (
    pg_catalog.length(pg_catalog.btrim(label)) between 1 and 80
  ),
  constraint units_amounts_non_negative check (base_rent >= 0 and charges >= 0),
  constraint units_room_count_positive check (room_count is null or room_count > 0)
);

create index if not exists units_organization_idx on public.units (organization_id);
create index if not exists units_property_idx on public.units (property_id);
create unique index if not exists units_property_label_key
  on public.units (property_id, lower(pg_catalog.btrim(label)));

-- ---------------------------------------------------------------------------
-- tenants : locataires.
-- ---------------------------------------------------------------------------

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text not null,
  whatsapp text,
  email text,
  id_document text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_full_name_length check (
    pg_catalog.length(pg_catalog.btrim(full_name)) between 2 and 120
  ),
  constraint tenants_phone_length check (
    pg_catalog.length(pg_catalog.btrim(phone)) between 6 and 30
  )
);

create index if not exists tenants_organization_idx on public.tenants (organization_id);

-- ---------------------------------------------------------------------------
-- leases : un lot lie a un locataire pour une periode donnee.
-- Le loyer et les charges sont copies sur le bail : leger une revision de
-- grille ne doit pas modifier retroactivement les echeances deja generees.
-- ---------------------------------------------------------------------------

create table if not exists public.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  start_date date not null,
  end_date date,
  rent_amount numeric(12, 2) not null default 0,
  charges_amount numeric(12, 2) not null default 0,
  deposit_amount numeric(12, 2) not null default 0,
  payment_day smallint not null default 1,
  status public.lease_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leases_amounts_non_negative check (
    rent_amount >= 0 and charges_amount >= 0 and deposit_amount >= 0
  ),
  constraint leases_payment_day_range check (payment_day between 1 and 28),
  constraint leases_dates_order check (end_date is null or end_date >= start_date)
);

create index if not exists leases_organization_idx on public.leases (organization_id);
create index if not exists leases_unit_idx on public.leases (unit_id);
create index if not exists leases_tenant_idx on public.leases (tenant_id);

-- Un lot ne peut avoir qu'un seul bail actif a la fois.
create unique index if not exists leases_single_active_per_unit
  on public.leases (unit_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- rent_calls : echeances mensuelles generees pour chaque bail actif.
-- ---------------------------------------------------------------------------

create table if not exists public.rent_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  period_year smallint not null,
  period_month smallint not null,
  due_date date not null,
  rent_amount numeric(12, 2) not null default 0,
  charges_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status public.rent_call_status not null default 'pending',
  last_reminder_at timestamptz,
  reminder_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_calls_period_month_range check (period_month between 1 and 12),
  constraint rent_calls_period_year_range check (period_year between 2000 and 2100),
  constraint rent_calls_amounts_non_negative check (
    rent_amount >= 0
    and charges_amount >= 0
    and total_amount >= 0
    and amount_paid >= 0
  ),
  constraint rent_calls_reminder_count_non_negative check (reminder_count >= 0)
);

-- Une echeance par bail et par mois : la generation est idempotente.
create unique index if not exists rent_calls_lease_period_key
  on public.rent_calls (lease_id, period_year, period_month);

create index if not exists rent_calls_organization_idx on public.rent_calls (organization_id);
create index if not exists rent_calls_period_idx on public.rent_calls (period_year, period_month);
create index if not exists rent_calls_status_idx on public.rent_calls (status);

-- ---------------------------------------------------------------------------
-- payments : reglements hors plateforme (mobile money, especes, virement).
-- La plateforme trace l'argent, elle ne l'encaisse pas.
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rent_call_id uuid not null references public.rent_calls(id) on delete cascade,
  amount numeric(12, 2) not null,
  method public.payment_method not null default 'cash',
  reference text,
  paid_at date not null default current_date,
  receipt_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_positive check (amount > 0),
  constraint payments_reference_length check (
    reference is null or pg_catalog.length(reference) <= 120
  )
);

create index if not exists payments_organization_idx on public.payments (organization_id);
create index if not exists payments_rent_call_idx on public.payments (rent_call_id);

-- ---------------------------------------------------------------------------
-- subscription_payments : paiements de l'abonnement SaaS via CinetPay.
-- Reseerve au service_role : aucune policy pour authenticated.
-- ---------------------------------------------------------------------------

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'cinetpay',
  amount numeric(12, 2) not null,
  currency text not null default 'XOF',
  status public.subscription_payment_status not null default 'pending',
  external_reference text,
  period_starts_at date,
  period_ends_at date,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_payments_amount_positive check (amount > 0)
);

create index if not exists subscription_payments_organization_idx
  on public.subscription_payments (organization_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.rent_calls enable row level security;
alter table public.payments enable row level security;
alter table public.subscription_payments enable row level security;

revoke all on
  public.profiles,
  public.owners,
  public.properties,
  public.units,
  public.tenants,
  public.leases,
  public.rent_calls,
  public.payments,
  public.subscription_payments
from public, anon;

grant select on public.profiles to authenticated;
grant update on public.profiles to authenticated;

grant select, insert, update, delete
  on public.owners, public.properties, public.units, public.tenants,
     public.leases, public.rent_calls, public.payments
  to authenticated;

-- subscription_payments : aucune grant a authenticated. Cette table reste
-- reservee au service_role utilise par le webhook CinetPay (role bypassrls).
-- Aucune policy n'est creee pour authenticated : la table reste inaccessible.

-- profiles : un utilisateur ne voit et ne modifie que sa propre ligne.

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tables metier : lecture pour tout membre, ecriture pour owner et manager.
-- Les policies sont ecrites explicitement (pas de boucle dynamique) pour rester
-- lisibles et apparaitre une par une dans le tableau de bord Supabase.

drop policy if exists owners_member_select on public.owners;
create policy owners_member_select
  on public.owners for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists owners_write_insert on public.owners;
create policy owners_write_insert
  on public.owners for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists owners_write_update on public.owners;
create policy owners_write_update
  on public.owners for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists owners_write_delete on public.owners;
create policy owners_write_delete
  on public.owners for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists properties_member_select on public.properties;
create policy properties_member_select
  on public.properties for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists properties_write_insert on public.properties;
create policy properties_write_insert
  on public.properties for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists properties_write_update on public.properties;
create policy properties_write_update
  on public.properties for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists properties_write_delete on public.properties;
create policy properties_write_delete
  on public.properties for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists units_member_select on public.units;
create policy units_member_select
  on public.units for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists units_write_insert on public.units;
create policy units_write_insert
  on public.units for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists units_write_update on public.units;
create policy units_write_update
  on public.units for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists units_write_delete on public.units;
create policy units_write_delete
  on public.units for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select
  on public.tenants for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists tenants_write_insert on public.tenants;
create policy tenants_write_insert
  on public.tenants for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists tenants_write_update on public.tenants;
create policy tenants_write_update
  on public.tenants for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists tenants_write_delete on public.tenants;
create policy tenants_write_delete
  on public.tenants for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists leases_member_select on public.leases;
create policy leases_member_select
  on public.leases for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists leases_write_insert on public.leases;
create policy leases_write_insert
  on public.leases for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists leases_write_update on public.leases;
create policy leases_write_update
  on public.leases for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists leases_write_delete on public.leases;
create policy leases_write_delete
  on public.leases for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists rent_calls_member_select on public.rent_calls;
create policy rent_calls_member_select
  on public.rent_calls for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists rent_calls_write_insert on public.rent_calls;
create policy rent_calls_write_insert
  on public.rent_calls for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists rent_calls_write_update on public.rent_calls;
create policy rent_calls_write_update
  on public.rent_calls for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists rent_calls_write_delete on public.rent_calls;
create policy rent_calls_write_delete
  on public.rent_calls for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists payments_member_select on public.payments;
create policy payments_member_select
  on public.payments for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists payments_write_insert on public.payments;
create policy payments_write_insert
  on public.payments for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists payments_write_update on public.payments;
create policy payments_write_update
  on public.payments for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists payments_write_delete on public.payments;
create policy payments_write_delete
  on public.payments for delete to authenticated
  using (public.can_write_org(organization_id));

-- ---------------------------------------------------------------------------
-- Trigger : updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists owners_set_updated_at on public.owners;
create trigger owners_set_updated_at
  before update on public.owners
  for each row execute function public.set_updated_at();

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

drop trigger if exists units_set_updated_at on public.units;
create trigger units_set_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

drop trigger if exists leases_set_updated_at on public.leases;
create trigger leases_set_updated_at
  before update on public.leases
  for each row execute function public.set_updated_at();

drop trigger if exists rent_calls_set_updated_at on public.rent_calls;
create trigger rent_calls_set_updated_at
  before update on public.rent_calls
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists subscription_payments_set_updated_at on public.subscription_payments;
create trigger subscription_payments_set_updated_at
  before update on public.subscription_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger : creation du profil a l'inscription
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Trigger : recalcul de l'echeance apres chaque mouvement de paiement
--
-- Regle metier reprise du cahier des charges : apres toute ecriture dans
-- payments, rent_calls.amount_paid vaut la somme des paiements de l'echeance et
-- le statut bascule automatiquement.
--
--   amount_paid = 0                      -> pending, ou overdue si echue a J+5
--   0 < amount_paid < total_amount       -> partial, ou overdue si echue a J+5
--   amount_paid >= total_amount > 0      -> paid
--
-- security definer : le recalcul doit s'executer meme quand la suppression
-- d'une echeance entraine en cascade la suppression de ses paiements.
-- ---------------------------------------------------------------------------

create or replace function public.recalculate_rent_call()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_rent_call_id uuid;
begin
  -- Un paiement deplace d'une echeance vers une autre laisse deux lignes a
  -- recalculer : la precedente et la nouvelle.
  if tg_op = 'DELETE' then
    perform public.refresh_rent_call_totals(old.rent_call_id);
    return null;
  end if;

  v_previous_rent_call_id := old.rent_call_id;

  if tg_op = 'UPDATE' and new.rent_call_id is distinct from old.rent_call_id then
    perform public.refresh_rent_call_totals(v_previous_rent_call_id);
  end if;

  perform public.refresh_rent_call_totals(new.rent_call_id);
  return null;
end;
$function$;

-- Recalcule une echeance a partir de ses paiements. Factorisee pour que le
-- declencheur reste lisible et pour garder une seule implementation de la
-- regle de bascule de statut.
create or replace function public.refresh_rent_call_totals(p_rent_call_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_total numeric(14, 2);
  v_paid numeric(14, 2);
  v_due_date date;
  v_status public.rent_call_status;
begin
  select rent_call.total_amount, rent_call.due_date
  into v_total, v_due_date
  from public.rent_calls as rent_call
  where rent_call.id = p_rent_call_id;

  -- L'echeance n'existe plus (suppression en cascade) : rien a recalculer.
  if not found then
    return;
  end if;

  select coalesce(sum(payment.amount), 0)
  into v_paid
  from public.payments as payment
  where payment.rent_call_id = p_rent_call_id;

  if v_total > 0 and v_paid >= v_total then
    v_status := 'paid'::public.rent_call_status;
  elsif v_paid > 0 and v_due_date < (current_date - 5) then
    v_status := 'overdue'::public.rent_call_status;
  elsif v_paid > 0 then
    v_status := 'partial'::public.rent_call_status;
  elsif v_due_date < (current_date - 5) then
    v_status := 'overdue'::public.rent_call_status;
  else
    v_status := 'pending'::public.rent_call_status;
  end if;

  update public.rent_calls as rent_call
  set amount_paid = v_paid,
      status = v_status
  where rent_call.id = p_rent_call_id;
end;
$function$;

drop trigger if exists payments_recalculate_rent_call on public.payments;
create trigger payments_recalculate_rent_call
  after insert or update or delete on public.payments
  for each row execute function public.recalculate_rent_call();

-- ---------------------------------------------------------------------------
-- Trigger : total_amount = rent_amount + charges_amount
-- Applique a l'insertion et a toute modification de l'un des deux montants.
-- ---------------------------------------------------------------------------

create or replace function public.compute_rent_call_total()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.total_amount := greatest(new.rent_amount + new.charges_amount, 0);
  return new;
end;
$function$;

drop trigger if exists rent_calls_compute_total on public.rent_calls;
create trigger rent_calls_compute_total
  before insert or update of rent_amount, charges_amount on public.rent_calls
  for each row execute function public.compute_rent_call_total();

-- ---------------------------------------------------------------------------
-- Generateur d'echeances mensuelles
--
-- Appele par le cron Vercel /api/cron/generate-rent-calls le 1er du mois.
-- Cree une echeance pour chaque bail actif dont la periode de Validite couvre
-- le mois demande. on conflict do nothing rend l'appel idempotent : un cron
-- relance ou un double appel ne cree pas de doublon.
--
-- reserve au service_role : appele par la route API cron, jamais par un client.
-- ---------------------------------------------------------------------------

create or replace function public.generate_monthly_rent_calls(
  p_year integer,
  p_month integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_created integer := 0;
  v_period_start date;
  v_period_end date;
begin
  if p_month < 1 or p_month > 12 then
    raise exception 'Invalid month' using errcode = '22023';
  end if;

  if p_year < 2000 or p_year > 2100 then
    raise exception 'Invalid year' using errcode = '22023';
  end if;

  v_period_start := make_date(p_year, p_month, 1);
  v_period_end := (v_period_start + interval '1 month')::date - 1;

  insert into public.rent_calls (
    organization_id,
    lease_id,
    period_year,
    period_month,
    due_date,
    rent_amount,
    charges_amount
  )
  select
    lease.organization_id,
    lease.id,
    p_year,
    p_month,
    make_date(p_year, p_month, lease.payment_day),
    lease.rent_amount,
    lease.charges_amount
  from public.leases as lease
  where lease.status = 'active'::public.lease_status
    and lease.start_date <= v_period_end
    and (lease.end_date is null or lease.end_date >= v_period_start)
  on conflict (lease_id, period_year, period_month) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end;
$function$;

revoke all on function public.generate_monthly_rent_calls(integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bascule en overdue des echeances echues depuis plus de 5 jours
--
-- Le declencheur de paiement ne recalcule que l'echeance concernee : une
-- echeance creee apres coup, ou jamais payee, resterait sinon en pending
-- indefiniment. Cette fonction est donc appelee par le meme cron que la
-- generation mensuelle.
--
-- Ne touche que les echeances non soldees : une echeance payee reste paid,
-- une echeance partiellement reglee reste partial ou overdue.
--
-- reserve au service_role : appele par la route API cron, jamais par un client.
-- ---------------------------------------------------------------------------

create or replace function public.mark_overdue_rent_calls()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_updated integer := 0;
begin
  update public.rent_calls as rent_call
  set status = 'overdue'::public.rent_call_status
  where rent_call.status in ('pending'::public.rent_call_status, 'partial'::public.rent_call_status)
    and rent_call.amount_paid < rent_call.total_amount
    and rent_call.due_date < (current_date - 5);

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$function$;

revoke all on function public.mark_overdue_rent_calls()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Nettoyage des privileges
-- Les fonctions de declenchement ne sont jamais appelees directement par un
-- client : seul set_updated_at reste accessible, ce qui est sans effet.
-- ---------------------------------------------------------------------------

revoke all on function public.set_updated_at() from public, anon;
revoke all on function public.compute_rent_call_total() from public, anon;
revoke all on function public.refresh_rent_call_totals(uuid) from public, anon, authenticated;
revoke all on function public.recalculate_rent_call() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.set_updated_at() to authenticated;
grant execute on function public.compute_rent_call_total() to authenticated;

-- Migration 3 : typologie detaillee des biens.
-- Depend de 20261001000100_create_business_schema.sql
-- (table units, colonne unit_type public.unit_type, contraintes de montant).
--
-- Objectif : remplacer l enum unit_type a 5 valeurs par la typologie reelle
-- d une agence ivoirienne (7 categories, 47 types), et remettre les attributs
-- variables dans une colonne JSONB plutot que d ajouter une colonne par type.

-- ---------------------------------------------------------------------------
-- Nouvelles categories et nouveau type de lot
-- ---------------------------------------------------------------------------

do $types$
begin
  create type public.property_category as enum (
    'residential',
    'commercial',
    'professional',
    'industrial',
    'tourism',
    'mixed',
    'land_annex'
  );
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.unit_type_v2 as enum (
    -- residentiel
    'studio',
    'studio_american',
    'apartment_f1',
    'apartment_f2',
    'apartment_f3',
    'apartment_f4',
    'apartment_f5',
    'apartment_f6_plus',
    'duplex',
    'triplex',
    'penthouse',
    'villa_low',
    'villa_duplex',
    'villa_triplex',
    'villa_twin',
    'villa_row',
    'house',
    'house_compound',
    'building_residential',
    -- commercial
    'shop',
    'commercial_unit',
    'store',
    'showroom',
    'kiosk',
    'market_stall',
    -- professionnel
    'office_single',
    'office_floor',
    'building_office',
    'cabinet',
    'coworking',
    'meeting_room',
    -- industriel
    'warehouse',
    'hangar',
    'workshop',
    'factory',
    'depot',
    'land_industrial',
    -- touristique
    'apartment_furnished',
    'villa_furnished',
    'residence_furnished',
    'hotel_room',
    'guesthouse',
    'residence_hotel',
    -- mixte
    'mixed_use',
    -- terrain et annexes
    'land',
    'land_serviced',
    'land_agricultural',
    'parking',
    'garage',
    'storage_room'
  );
exception
  when duplicate_object then null;
end;
$types$;

-- ---------------------------------------------------------------------------
-- Colonnes de typologie
--
-- Le nouveau type est stocke dans unit_type_v2 et non dans unit_type : la
-- colonne d'origine est conservee pour la compatibilite et pourra etre
-- supprimee lorsque plus aucun code ne la lit.
-- ---------------------------------------------------------------------------

alter table public.units
  add column if not exists category text not null default 'residential',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists deposit_amount numeric(12, 2) not null default 0,
  add column if not exists building_section text,
  add column if not exists floor text,
  add column if not exists unit_type_v2 public.unit_type_v2;

-- Conversion des 5 anciennes valeurs vers la nouvelle typologie.
--
-- apartment -> apartment_f2 : l ancien type ne distinguait pas le nombre de
--   pieces. F2 est le cas le plus courant a Abidjan et le defaut du
--   formulaire actuel, ce qui evite une regression visible.
-- shop     -> shop
-- office   -> office_single
-- parking  -> parking
-- land     -> land
--
-- La colonne est vide juste apres sa creation. Si la migration est relansee
-- apres une execution partielle, certaines lignes peuvent porter deja une
-- valeur : la condition porte donc sur la coherence avec l ancien type, pas
-- seulement sur un NULL, sinon une ligne restee a defaut ne serait jamais
-- corrigee.

update public.units set unit_type_v2 = case unit_type::text
  when 'apartment' then 'apartment_f2'::public.unit_type_v2
  when 'shop'     then 'shop'::public.unit_type_v2
  when 'office'   then 'office_single'::public.unit_type_v2
  when 'parking'  then 'parking'::public.unit_type_v2
  when 'land'     then 'land'::public.unit_type_v2
  else 'apartment_f2'::public.unit_type_v2
end
where unit_type_v2 is null
   or unit_type_v2::text <> case unit_type::text
        when 'apartment' then 'apartment_f2'
        when 'shop'     then 'shop'
        when 'office'   then 'office_single'
        when 'parking'  then 'parking'
        when 'land'     then 'land'
        else 'apartment_f2'
      end;

alter table public.units
  alter column unit_type_v2 set default 'apartment_f2',
  alter column unit_type_v2 set not null;

-- ---------------------------------------------------------------------------
-- Integrite categorie / type
--
-- La correspondance est imposee en base et pas seulement dans le formulaire,
-- donc une requete directe ou un import ne peut pas creer un type incoherent
-- avec sa categorie.
-- ---------------------------------------------------------------------------

-- Les contraintes sont posees de facon conditionnelle : la migration doit
-- pouvoir etre relancee apres une execution partielle.

do $constraints$
begin
  alter table public.units
    add constraint units_category_allowed check (
      category in (
        'residential',
        'commercial',
        'professional',
        'industrial',
        'tourism',
        'mixed',
        'land_annex'
      )
    );
exception
  when duplicate_object then null;
end;
$constraints$;

create or replace function public.unit_type_matches_category(
  p_type public.unit_type_v2,
  p_category text
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select case p_category
    when 'residential' then p_type::text in (
      'studio', 'studio_american', 'apartment_f1', 'apartment_f2', 'apartment_f3',
      'apartment_f4', 'apartment_f5', 'apartment_f6_plus', 'duplex', 'triplex',
      'penthouse', 'villa_low', 'villa_duplex', 'villa_triplex', 'villa_twin',
      'villa_row', 'house', 'house_compound', 'building_residential')
    when 'commercial' then p_type::text in (
      'shop', 'commercial_unit', 'store', 'showroom', 'kiosk', 'market_stall')
    when 'professional' then p_type::text in (
      'office_single', 'office_floor', 'building_office', 'cabinet',
      'coworking', 'meeting_room')
    when 'industrial' then p_type::text in (
      'warehouse', 'hangar', 'workshop', 'factory', 'depot', 'land_industrial')
    when 'tourism' then p_type::text in (
      'apartment_furnished', 'villa_furnished', 'residence_furnished',
      'hotel_room', 'guesthouse', 'residence_hotel')
    when 'mixed' then p_type::text in ('mixed_use')
    when 'land_annex' then p_type::text in (
      'land', 'land_serviced', 'land_agricultural', 'parking', 'garage', 'storage_room')
    else false
  end;
$function$;

revoke all on function public.unit_type_matches_category(public.unit_type_v2, text)
  from public, anon;

-- La categorie se deduit du type pour les lots converts : sans cela la
-- contrainte croisable ci-dessous rejetterait les lignes existantes, dont la
-- categorie par defaut residential ne correspond pas a un bureau ou un parking.

update public.units unit
set category = case
  when unit.unit_type_v2::text in (
    'shop', 'commercial_unit', 'store', 'showroom', 'kiosk', 'market_stall')
    then 'commercial'
  when unit.unit_type_v2::text in (
    'office_single', 'office_floor', 'building_office', 'cabinet',
    'coworking', 'meeting_room')
    then 'professional'
  when unit.unit_type_v2::text in (
    'warehouse', 'hangar', 'workshop', 'factory', 'depot', 'land_industrial')
    then 'industrial'
  when unit.unit_type_v2::text in (
    'apartment_furnished', 'villa_furnished', 'residence_furnished',
    'hotel_room', 'guesthouse', 'residence_hotel')
    then 'tourism'
  when unit.unit_type_v2::text = 'mixed_use'
    then 'mixed'
  when unit.unit_type_v2::text in (
    'land', 'land_serviced', 'land_agricultural', 'parking', 'garage', 'storage_room')
    then 'land_annex'
  else 'residential'
end
where not public.unit_type_matches_category(unit.unit_type_v2, unit.category);

do $constraints$
begin
  alter table public.units
    add constraint units_type_matches_category check (
      public.unit_type_matches_category(unit_type_v2, category)
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- ---------------------------------------------------------------------------
-- Index de consultation et montant de garantie
-- ---------------------------------------------------------------------------

create index if not exists units_category_idx
  on public.units (organization_id, category);

create index if not exists units_type_v2_idx
  on public.units (organization_id, unit_type_v2);

create index if not exists units_property_status_idx
  on public.units (property_id, status);

do $constraints$
begin
  alter table public.units
    add constraint units_deposit_non_negative check (deposit_amount >= 0);
exception
  when duplicate_object then null;
end;
$constraints$;

-- Migration 4 : etat des lieux et inventaire du mobilier.
-- Depend de 20261001000100_create_business_schema.sql
-- (tables leases, organizations, memberships, fonction public.set_updated_at,
--  fonctions de politique is_org_member et can_write_org).
--
-- Deux concepts distincts, souvent confondus :
--   - l inventaire liste les objets MOBILES (frigo, TV, machine a laver) ;
--   - l etat des lieux verifie le BATI piece par piece (murs, sol, prises).
-- Un logement meublé a besoin des deux, a l entree comme a la sortie, et c est
-- leur comparaison qui protege juridiquement l agence et le proprietaire.
--
-- La migration est idempotente : elle peut etre relancee sans risque.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $types$
begin
  create type public.item_condition as enum (
    'new',
    'good',
    'fair',
    'worn',
    'damaged',
    'missing',
    'replaced'
  );
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.inspection_type as enum (
    'move_in',
    'move_out',
    'periodic',
    'pre_rental'
  );
exception
  when duplicate_object then null;
end;
$types$;

do $types$
begin
  create type public.inspection_status as enum (
    'draft',
    'tenant_signed',
    'landlord_signed',
    'completed',
    'disputed'
  );
exception
  when duplicate_object then null;
end;
$types$;

-- ---------------------------------------------------------------------------
-- Catalogue d objets (referentiel partage)
--
-- organization_id null = catalogue systeme, lisible par toutes les agences.
-- Une organisation peut y ajouter ses propres objets sans modifier le systeme.
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category text not null,
  name text not null,
  default_quantity integer not null default 1,
  icon text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint inventory_catalog_name_length check (
    pg_catalog.length(pg_catalog.btrim(name)) between 1 and 120
  ),
  constraint inventory_catalog_quantity_positive check (default_quantity > 0)
);

create index if not exists inventory_catalog_organization_idx
  on public.inventory_catalog (organization_id);

create index if not exists inventory_catalog_category_idx
  on public.inventory_catalog (category);

-- Un objet systeme ne peut pas etre duplique : sans cette contrainte, la
-- migration de catalogue pourrait creer des doublons a chaque rejeu.
create unique index if not exists inventory_catalog_system_key
  on public.inventory_catalog (category, name)
  where organization_id is null;

create unique index if not exists inventory_catalog_own_key
  on public.inventory_catalog (organization_id, category, name)
  where organization_id is not null;

-- ---------------------------------------------------------------------------
-- Inventaire du mobilier, par bail
-- ---------------------------------------------------------------------------

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  catalog_id uuid references public.inventory_catalog(id) on delete set null,

  -- Copie du nom au moment de l ajout : si le catalogue evolue, l inventaire
  -- conserve le libelle d origine. C est la preuve en cas de litige.
  name text not null,
  category text,

  quantity integer not null default 1,
  condition public.item_condition not null default 'good',
  notes text,
  photo_url text,

  -- Suivi des mouvements apres l entree du locataire
  added_after_move_in boolean not null default false,
  replaced_item_id uuid references public.inventory_items(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_name_length check (
    pg_catalog.length(pg_catalog.btrim(name)) between 1 and 120
  ),
  constraint inventory_items_quantity_positive check (quantity > 0),
  -- Un objet endommage sans note n explique rien a la sortie du locataire :
  -- la note devient obligatoire dans ce cas.
  constraint inventory_items_damaged_requires_note check (
    condition <> 'damaged'::public.item_condition
    or (notes is not null and pg_catalog.length(pg_catalog.btrim(notes)) > 0)
  )
);

create index if not exists inventory_items_lease_idx on public.inventory_items (lease_id);
create index if not exists inventory_items_organization_idx
  on public.inventory_items (organization_id);
create index if not exists inventory_items_condition_idx
  on public.inventory_items (organization_id, condition);

-- ---------------------------------------------------------------------------
-- Etat des lieux (bati)
-- ---------------------------------------------------------------------------

create table if not exists public.inspection_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,

  type public.inspection_type not null,
  status public.inspection_status not null default 'draft',
  inspection_date date not null default current_date,
  conducted_by uuid references auth.users(id) on delete set null,

  tenant_present boolean not null default false,

  -- Compteurs : indispensable en Cote d Ivoire pour regulariser les charges
  water_meter_index numeric(14, 2),
  electricity_meter_index numeric(14, 2),

  general_notes text,

  tenant_signature_url text,
  landlord_signature_url text,
  tenant_signed_at timestamptz,
  landlord_signed_at timestamptz,

  pdf_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_reports_meter_non_negative check (
    (water_meter_index is null or water_meter_index >= 0)
    and (electricity_meter_index is null or electricity_meter_index >= 0)
  )
);

create index if not exists inspection_reports_lease_idx on public.inspection_reports (lease_id);
create index if not exists inspection_reports_organization_idx
  on public.inspection_reports (organization_id);
create index if not exists inspection_reports_type_idx on public.inspection_reports (type);
-- La comparaison entree / sortie cherche systematiquement les deux rapports
-- d un meme bail : cet index evite un parcours de la table.
create index if not exists inspection_reports_lease_type_idx
  on public.inspection_reports (lease_id, type);

-- ---------------------------------------------------------------------------
-- Details : un enregistrement par element verifie
-- ---------------------------------------------------------------------------

create table if not exists public.inspection_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.inspection_reports(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  room text not null,
  element text not null,

  condition public.item_condition not null,
  notes text,
  photo_url text,

  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspection_items_room_length check (
    pg_catalog.length(pg_catalog.btrim(room)) between 1 and 80
  ),
  constraint inspection_items_element_length check (
    pg_catalog.length(pg_catalog.btrim(element)) between 1 and 80
  ),
  constraint inspection_items_damaged_requires_note check (
    condition <> 'damaged'::public.item_condition
    or (notes is not null and pg_catalog.length(pg_catalog.btrim(notes)) > 0)
  )
);

create index if not exists inspection_items_report_idx on public.inspection_items (report_id);
create index if not exists inspection_items_organization_idx
  on public.inspection_items (organization_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
--
-- La fonction public.set_updated_at est creee par la migration 2. Les triggers
-- sont recrees a chaque execution pour rester idempotents.
-- ---------------------------------------------------------------------------

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

drop trigger if exists inspection_reports_set_updated_at on public.inspection_reports;
create trigger inspection_reports_set_updated_at
  before update on public.inspection_reports
  for each row execute function public.set_updated_at();

drop trigger if exists inspection_items_set_updated_at on public.inspection_items;
create trigger inspection_items_set_updated_at
  before update on public.inspection_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.inventory_catalog enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inspection_reports enable row level security;
alter table public.inspection_items enable row level security;

revoke all on
  public.inventory_catalog,
  public.inventory_items,
  public.inspection_reports,
  public.inspection_items
from public, anon;

-- catalogue : lecture du systeme par tous, ecriture de son propre catalogue
grant select on public.inventory_catalog to authenticated;
grant insert, update, delete on public.inventory_catalog to authenticated;

grant select, insert, update, delete
  on public.inventory_items, public.inspection_reports, public.inspection_items
  to authenticated;

drop policy if exists inventory_catalog_read on public.inventory_catalog;
create policy inventory_catalog_read
  on public.inventory_catalog for select to authenticated
  using (
    organization_id is null
    or public.is_org_member(organization_id)
  );

-- L ecriture du catalogue est reservee au catalogue de son organisation : la
-- clause with check interdit d ecrire dans le catalogue systeme, qui doit rester
-- identique pour toutes les agences.
drop policy if exists inventory_catalog_write on public.inventory_catalog;
create policy inventory_catalog_write
  on public.inventory_catalog for insert to authenticated
  with check (
    organization_id is not null
    and public.can_write_org(organization_id)
  );

drop policy if exists inventory_catalog_update on public.inventory_catalog;
create policy inventory_catalog_update
  on public.inventory_catalog for update to authenticated
  using (
    organization_id is not null
    and public.can_write_org(organization_id)
  )
  with check (
    organization_id is not null
    and public.can_write_org(organization_id)
  );

drop policy if exists inventory_catalog_delete on public.inventory_catalog;
create policy inventory_catalog_delete
  on public.inventory_catalog for delete to authenticated
  using (
    organization_id is not null
    and public.can_write_org(organization_id)
  );

-- Les trois tables metier suivent la meme regle que le reste du schema :
-- lecture pour tout membre, ecriture pour owner et manager.

drop policy if exists inventory_items_read on public.inventory_items;
create policy inventory_items_read
  on public.inventory_items for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists inventory_items_insert on public.inventory_items;
create policy inventory_items_insert
  on public.inventory_items for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists inventory_items_update on public.inventory_items;
create policy inventory_items_update
  on public.inventory_items for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists inventory_items_delete on public.inventory_items;
create policy inventory_items_delete
  on public.inventory_items for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists inspection_reports_read on public.inspection_reports;
create policy inspection_reports_read
  on public.inspection_reports for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists inspection_reports_insert on public.inspection_reports;
create policy inspection_reports_insert
  on public.inspection_reports for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists inspection_reports_update on public.inspection_reports;
create policy inspection_reports_update
  on public.inspection_reports for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists inspection_reports_delete on public.inspection_reports;
create policy inspection_reports_delete
  on public.inspection_reports for delete to authenticated
  using (public.can_write_org(organization_id));

drop policy if exists inspection_items_read on public.inspection_items;
create policy inspection_items_read
  on public.inspection_items for select to authenticated
  using (public.is_org_member(organization_id));

drop policy if exists inspection_items_insert on public.inspection_items;
create policy inspection_items_insert
  on public.inspection_items for insert to authenticated
  with check (public.can_write_org(organization_id));

drop policy if exists inspection_items_update on public.inspection_items;
create policy inspection_items_update
  on public.inspection_items for update to authenticated
  using (public.can_write_org(organization_id))
  with check (public.can_write_org(organization_id));

drop policy if exists inspection_items_delete on public.inspection_items;
create policy inspection_items_delete
  on public.inspection_items for delete to authenticated
  using (public.can_write_org(organization_id));

-- ---------------------------------------------------------------------------
-- Bucket prive pour les photos d etat des lieux et d inventaire
--
-- Les chemins sont stockes sous la forme <organization_id>/<dossier>/<fichier> :
-- l isolement est donc verifie par le premier segment du chemin, comme le
-- propose le cahier des charges.
--
-- Ce bloc est encadre : il ne s execute que si le schema storage existe, ce qui
-- permet de rejouer les migrations sur un Postgres de test depourvu de Storage.
-- ---------------------------------------------------------------------------

do $storage$
begin
  insert into storage.buckets (id, name, public)
  values ('inspection-photos', 'inspection-photos', false)
  on conflict (id) do nothing;

  drop policy if exists "inspection photos: read" on storage.objects;
  create policy "inspection photos: read"
    on storage.objects for select
    to authenticated
    using (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] in (
        select membership.organization_id::text
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
      )
    );

  drop policy if exists "inspection photos: insert" on storage.objects;
  create policy "inspection photos: insert"
    on storage.objects for insert
    to authenticated
    with check (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] in (
        select membership.organization_id::text
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.role in ('owner'::public.member_role, 'manager'::public.member_role)
      )
    );

  drop policy if exists "inspection photos: delete" on storage.objects;
  create policy "inspection photos: delete"
    on storage.objects for delete
    to authenticated
    using (
      bucket_id = 'inspection-photos'
      and (storage.foldername(name))[1] in (
        select membership.organization_id::text
        from public.memberships as membership
        where membership.user_id = (select auth.uid())
          and membership.role in ('owner'::public.member_role, 'manager'::public.member_role)
      )
    );
exception
  when undefined_table or undefined_function then
    -- Schema storage absent : le bucket sera cree a la main sur le projet.
    raise notice 'Schema storage absent : bucket inspection-photos non cree.';
end;
$storage$;


-- Migration 5 : catalogue systeme des objets d inventaire.
-- Depend de 20261001000300_add_inventory_and_inspection.sql
-- (table public.inventory_catalog et son index unique partiel).
--
-- organization_id est null : ces objets sont partages par toutes les agences.
-- Une agence peut ensuite ajouter ses propres objets sans toucher a ceux-ci.
--
-- Le catalogue est adresse par le nom de la piece et celui de l objet. Deux
-- insertions concurrentes(ne migration et un formulaire) ne peuvent donc pas
-- creer de doublon : on conflict do nothing laisse la ligne existante.

insert into public.inventory_catalog (organization_id, category, name, default_quantity, sort_order) values
-- Salon / Séjour
  (null, 'Salon', 'Canapé 3 places', 1, 10),
  (null, 'Salon', 'Canapé 2 places', 1, 11),
  (null, 'Salon', 'Fauteuil', 1, 12),
  (null, 'Salon', 'Table basse', 1, 13),
  (null, 'Salon', 'Table à manger', 1, 14),
  (null, 'Salon', 'Chaise', 4, 15),
  (null, 'Salon', 'Buffet / Vaisselier', 1, 16),
  (null, 'Salon', 'Meuble TV', 1, 17),
  (null, 'Salon', 'Télévision', 1, 18),
  (null, 'Salon', 'Décodeur TV', 1, 19),
  (null, 'Salon', 'Ventilateur plafond', 1, 20),
  (null, 'Salon', 'Ventilateur sur pied', 1, 21),
  (null, 'Salon', 'Climatiseur split', 1, 22),
  (null, 'Salon', 'Rideaux', 1, 23),
  (null, 'Salon', 'Tapis', 1, 24),
  (null, 'Salon', 'Lustre / Luminaire', 1, 25),
  (null, 'Salon', 'Miroir', 1, 26),
-- Chambre
  (null, 'Chambre', 'Lit simple', 1, 30),
  (null, 'Chambre', 'Lit double', 1, 31),
  (null, 'Chambre', 'Lit superposé', 1, 32),
  (null, 'Chambre', 'Matelas simple', 1, 33),
  (null, 'Chambre', 'Matelas double', 1, 34),
  (null, 'Chambre', 'Sommier', 1, 35),
  (null, 'Chambre', 'Armoire / Penderie', 1, 36),
  (null, 'Chambre', 'Commode', 1, 37),
  (null, 'Chambre', 'Table de chevet', 1, 38),
  (null, 'Chambre', 'Coiffeuse', 1, 39),
  (null, 'Chambre', 'Miroir', 1, 40),
  (null, 'Chambre', 'Ventilateur', 1, 41),
  (null, 'Chambre', 'Climatiseur', 1, 42),
  (null, 'Chambre', 'Rideaux', 1, 43),
  (null, 'Chambre', 'Tapis', 1, 44),
-- Cuisine
  (null, 'Cuisine', 'Réfrigérateur', 1, 50),
  (null, 'Cuisine', 'Congelateur', 1, 51),
  (null, 'Cuisine', 'Cuisinière gaz', 1, 52),
  (null, 'Cuisine', 'Cuisinière electrique', 1, 53),
  (null, 'Cuisine', 'Plaque de cuisson', 1, 54),
  (null, 'Cuisine', 'Four', 1, 55),
  (null, 'Cuisine', 'Micro-ondes', 1, 56),
  (null, 'Cuisine', 'Hotte aspirante', 1, 57),
  (null, 'Cuisine', 'Évier', 1, 58),
  (null, 'Cuisine', 'Lave-vaisselle', 1, 59),
  (null, 'Cuisine', 'Bouilloire', 1, 60),
  (null, 'Cuisine', 'Cafetière', 1, 61),
  (null, 'Cuisine', 'Grille-pain', 1, 62),
  (null, 'Cuisine', 'Blender / Mixeur', 1, 63),
  (null, 'Cuisine', 'Batterie de Cuisine', 1, 64),
  (null, 'Cuisine', 'Service de vaisselle', 1, 65),
  (null, 'Cuisine', 'Couverts (set)', 1, 66),
  (null, 'Cuisine', 'Verres', 6, 67),
  (null, 'Cuisine', 'Tasses', 6, 68),
  (null, 'Cuisine', 'Poubelle', 1, 69),
  (null, 'Cuisine', 'Balai', 1, 70),
  (null, 'Cuisine', 'Serpillère + seau', 1, 71),
-- Salle de bain
  (null, 'Salle de bain', 'Douche', 1, 80),
  (null, 'Salle de bain', 'Baignoire', 1, 81),
  (null, 'Salle de bain', 'Lavabo', 1, 82),
  (null, 'Salle de bain', 'WC', 1, 83),
  (null, 'Salle de bain', 'Miroir', 1, 84),
  (null, 'Salle de bain', 'Porte-serviettes', 1, 85),
  (null, 'Salle de bain', 'Chauffe-eau', 1, 86),
  (null, 'Salle de bain', 'Rideau de douche', 1, 87),
  (null, 'Salle de bain', 'Pommeau de douche', 1, 88),
-- Buanderie
  (null, 'Buanderie', 'Machine à laver', 1, 90),
  (null, 'Buanderie', 'Fer à repasser', 1, 91),
  (null, 'Buanderie', 'Table à repasser', 1, 92),
  (null, 'Buanderie', 'Étendoir à linge', 1, 93),
  (null, 'Buanderie', 'Panier à linge', 1, 94),
-- Divers
  (null, 'Divers', 'Extincteur', 1, 100),
  (null, 'Divers', 'Détecteur de fumee', 1, 101),
  (null, 'Divers', 'Groupe électrogène', 1, 102),
  (null, 'Divers', 'Clés (jeu)', 2, 103),
  (null, 'Divers', 'Badges / Télécommandes portail', 1, 104),
-- Extérieur (villa)
  (null, 'Extérieur', 'Mobilier de jardin', 1, 110),
  (null, 'Extérieur', 'Barbecue', 1, 111),
  (null, 'Extérieur', 'Parasol', 1, 112),
  (null, 'Extérieur', 'Transat', 1, 113)
on conflict do nothing;

-- Migration 6 : reglages de prorata et de revision du bail.
-- Depend de 20261001000100_create_business_schema.sql (table public.leases).
--
-- Cadre juridique
-- ---------------
-- Loi n 2019-576 du 26 juin 2019 instituant le Code de la Construction et de
-- l Habitat, livre 2, titre 1, sous-titre 2 (art. 408 a 456) :
--   art. 415 : deux mois de loyers d avance au maximum ;
--   art. 416 : deux mois de loyer au maximum pour le depot de garantie ;
--   art. 455 : une augmentation est reputee n etre jamais intervenue si elle a
--              lieu moins de trois annees apres la conclusion du bail.
--
-- Ces trois plafonds sont poses en base, donc opposables meme a une requete
-- directe ou a un import : l agent ne peut pas enregistrer un acte illegal.
--
-- En revanche la loi ne fixe aucune formule de prorata. Le mode et la base sont
-- donc des reglages contractuels, propre a chaque agence, et non des colonnes
-- imposees : ils sont stockes pour que la regle appliquee reste connue au moment
-- du calcul et opposable en cas de litige.
--
-- Le decret n 2024-1115 du 19 decembre 2024 plafonne les frais d intermediction
-- a un mois de loyer hors taxes, partage a parts egales entre bailleur et
-- locataire. Son libelle exact n a pas pu etre verifie au Journal Officiel :
-- aucune contrainte n est donc posee sur ce point, seule l information est
-- rappelee dans l application.

-- ---------------------------------------------------------------------------
-- Reglages de prorata
-- ---------------------------------------------------------------------------

alter table public.leases
  add column if not exists prorata_mode text not null default 'days_remaining',
  add column if not exists prorata_basis text not null default 'calendar_month';

do $constraints$
begin
  alter table public.leases
    add constraint leases_prorata_mode_allowed check (
      prorata_mode in ('days_remaining', 'days_remaining_plus_one', 'full_month')
    );
exception
  when duplicate_object then null;
end;
$constraints$;

do $constraints$
begin
  alter table public.leases
    add constraint leases_prorata_basis_allowed check (
      prorata_basis in ('calendar_month', 'thirty_day_month')
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- ---------------------------------------------------------------------------
-- Depôt de garantie : article 416
--
-- Le plafond porte sur le loyer seul. Les charges couvrent des frais variables
-- ou des services, pas la valeur du bien mis en location : les inclure
-- releverait le plafond sans fondement.
-- ---------------------------------------------------------------------------

do $constraints$
begin
  alter table public.leases
    add constraint leases_deposit_within_legal_cap check (
      deposit_amount <= rent_amount * 2
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- ---------------------------------------------------------------------------
-- Revision du loyer : article 455
--
-- Le taux est exprime en pourcentage et plafonne a 20 %. Le delai legal de
-- trois ans est porte par la colonne revision_allowed_at, calcule a la
-- conclusion du bail ; une revision ne peut etre enregistree qu apres cette
-- date.
-- ---------------------------------------------------------------------------

alter table public.leases
  add column if not exists revision_rate numeric(5, 2) not null default 0,
  add column if not exists revision_allowed_at date;

do $constraints$
begin
  alter table public.leases
    add constraint leases_revision_rate_range check (
      revision_rate >= 0 and revision_rate <= 20
    );
exception
  when duplicate_object then null;
end;
$constraints$;

-- La date d autorisation de revision vaut trois ans apres la conclusion du bail
-- (article 455). Elle est renseignee automatiquement a la creation, et recalculee
-- si la date de debut change.

create or replace function public.set_lease_revision_allowed_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.revision_allowed_at := (new.start_date + interval '3 years')::date;
  return new;
end;
$function$;

drop trigger if exists leases_set_revision_allowed_at on public.leases;
create trigger leases_set_revision_allowed_at
  before insert or update of start_date on public.leases
  for each row execute function public.set_lease_revision_allowed_at();


-- ===========================================================================
-- VERIFICATION : a lancer apres la migration
-- Resultat attendu :  15 | 49 | 21 | 77 | 3 | 1 | 1 | 4
-- soit 15 tables, 49 policies, 21 triggers, 77 objets au catalogue,
-- 3 enums d etat des lieux, 1 type de bien detaille, 1 contrainte de
-- correspondance, et 4 colonnes de reglage du bail (prorata_mode,
-- prorata_basis, revision_rate, revision_allowed_at).
-- ===========================================================================
select
  (select count(*) from pg_tables where schemaname = 'public')
  || ' | ' || (select count(*) from pg_policies where schemaname = 'public')
  || ' | ' || (select count(*) from information_schema.triggers
                where trigger_schema = 'public')
  || ' | ' || (select count(*) from public.inventory_catalog
                where organization_id is null)
  || ' | ' || (select count(*) from pg_type
                where typname in ('item_condition', 'inspection_type', 'inspection_status'))
  || ' | ' || (select count(*) from pg_type where typname = 'unit_type_v2')
  || ' | ' || (select count(*) from pg_constraint
                where conname = 'units_type_matches_category')
  || ' | ' || (select count(*) from information_schema.columns
                where table_schema = 'public' and table_name = 'leases'
                  and column_name in ('prorata_mode', 'prorata_basis',
                                      'revision_rate', 'revision_allowed_at'))
  as "verif";
