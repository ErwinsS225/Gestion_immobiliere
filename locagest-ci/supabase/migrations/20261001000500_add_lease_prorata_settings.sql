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
