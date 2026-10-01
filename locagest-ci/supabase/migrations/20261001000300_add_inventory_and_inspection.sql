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

