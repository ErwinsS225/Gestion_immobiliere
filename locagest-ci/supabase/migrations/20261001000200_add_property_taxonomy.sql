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
