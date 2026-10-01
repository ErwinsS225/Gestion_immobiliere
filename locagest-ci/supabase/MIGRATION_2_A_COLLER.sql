-- ===========================================================================
-- LOCAGEST CI - Migration 2 : schema metier
-- A coller dans Supabase > SQL Editor > New query > Run
--
-- Source de verite : supabase/migrations/20261001000100_create_business_schema.sql
--
-- Cette migration est idempotente : elle peut etre relancee sans risque.
--
-- ETAPE 1 - verifier que la migration 1 est deja en place.
-- Cette requete doit renvoyer 2 avant de continuer.
select count(*) as "migrations prealables (attendu 2)"
from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'memberships');

-- ===========================================================================

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


-- ===========================================================================
-- VERIFICATION : a lancer apres la migration
-- Resultat attendu :  9 | 33 | 14
-- ===========================================================================
select
  (select count(*) from pg_tables
    where schemaname = 'public'
      and tablename in ('profiles','owners','properties','units','tenants',
                        'leases','rent_calls','payments','subscription_payments'))
  || ' | ' || (select count(*) from pg_policies where schemaname = 'public')
  || ' | ' || (select count(*) from information_schema.triggers
                where trigger_schema = 'public')
  as "tables | policies | triggers (attendu 9 | 33 | 14)";
