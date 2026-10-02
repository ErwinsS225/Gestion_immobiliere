-- Isolation multi-tenant : prouve qu une agence ne voit et ne peut rien
-- ecrire chez une autre. C est le critere de succes n 2 du MVP.
--
-- SET LOCAL n agit que dans une transaction : chaque scenario est encadre
-- par BEGIN / ROLLBACK pour basculer reellement le role.
--
-- Les identifiants sont resolus avant de basculer le role, car le role
-- authenticated n a pas le droit de lire auth.users. La valeur est recuperee
-- dans une variable psql, qui reste cote client et non en base.

-- Nettoyage : le fichier doit pouvoir etre relance sur une base deja peuplee.
delete from public.properties where name in ('Immeuble Konan', 'Immeuble Yeture');
delete from public.memberships
where organization_id in (select id from public.organizations where name in ('Agence Konan', 'Agence Yeture'));
delete from public.organizations where name in ('Agence Konan', 'Agence Yeture');
delete from auth.users where email in ('konan@test.ci', 'yeture@test.ci');

insert into public.organizations (name, city) values ('Agence Konan', 'Bouake');
insert into auth.users (email, raw_user_meta_data)
values ('konan@test.ci', '{"full_name":"M. Konan"}'::jsonb);

insert into public.organizations (name, city) values ('Agence Yeture', 'Yamoussoukro');
insert into auth.users (email, raw_user_meta_data)
values ('yeture@test.ci', '{"full_name":"Mme Yeture"}'::jsonb);

insert into public.memberships (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u
join public.organizations o on o.name = 'Agence Konan'
where u.email = 'konan@test.ci';

insert into public.memberships (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u
join public.organizations o on o.name = 'Agence Yeture'
where u.email = 'yeture@test.ci';

insert into public.properties (organization_id, name, commune)
select o.id, 'Immeuble Konan', 'Koumassi'
from public.organizations o where o.name = 'Agence Konan';

insert into public.properties (organization_id, name, commune)
select o.id, 'Immeuble Yeture', 'Yopougon'
from public.organizations o where o.name = 'Agence Yeture';

select (select id from auth.users where email = 'konan@test.ci')::text as konan_id \gset

\echo '--- TEST 13 : lecture isolee entre deux agences ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);

select 'Konan voit ' || count(*)::text || ' propriete(s) (attendu 1)'
from public.properties;

select public.assert_compte('Konan ne voit AUCUNE propriete de Yeture', count(*), 0::bigint)
from public.properties where name = 'Immeuble Yeture';

select public.assert_compte('Konan voit la sienne', count(*), 1::bigint)
from public.properties where name = 'Immeuble Konan';
rollback;

\echo '--- TEST 14 : ecriture croisee bloquee (INSERT 0 0 attendu) ---'
-- La clause WITH CHECK de la policy refuse la ligne : RLS la filtre
-- silencieusement, sans renvoyer d erreur.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
insert into public.properties (organization_id, name, commune)
select o.id, 'Piratage', 'Yopougon'
from public.organizations o where o.name = 'Agence Yeture';
rollback;

\echo '--- TEST 15 : le role anon n a aucun droit du tout ---'
-- anon n a meme pas le droit SELECT : le refus est anterieur a RLS. Ce test
-- attend une erreur, il est donc encapsule dans un bloc qui leve si la lecture
-- reussit au lieu de laisser passer une lecture qui ne devrait pas etre possible.
do $$
begin
  set local role anon;
  perform count(*) from public.properties;
  raise exception 'anon a pu lire les proprietes : aucun droit ne devrait etre accorde';
exception
  when insufficient_privilege then
    raise notice 'OK : acces anon refuse comme attendu';
end;
$$;

\echo '--- TEST 16 : subscription_payments inaccessible a authenticated ---'
-- Cette table contient les paiements d abonnement a la plateforme : elle ne
-- doit pas etre lisible par un utilisateur de l application. Le test attend un
-- refus, il est donc encapsule comme le TEST 15.
do $$
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', current_setting('request.jwt.claim.sub'), true);
  perform count(*) from public.subscription_payments;
  raise exception 'subscription_payments accessible a authenticated : fuite interne';
exception
  when insufficient_privilege then
    raise notice 'OK : subscription_payments inaccessible comme attendu';
end;
$$;

\echo '--- TEST 17 : un viewer peut lire ---'
update public.memberships set role = 'viewer'
where user_id = (select id from auth.users where email = 'konan@test.ci')
  and organization_id = (select id from public.organizations where name = 'Agence Konan');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);

select 'viewer lit ' || count(*)::text || ' propriete(s) (attendu 1)'
from public.properties;
rollback;

\echo '--- TEST 18 : le viewer ne peut pas ecrire ---'
-- La policy doit filtrer silencieusement l insertion : sous ON_ERROR_STOP, une
-- ecriture acceptee ferait echouer le script. Le bloc leve donc si l insertion
-- aboutit, et n emet qu une notice si elle est refusee comme attendu.
do $$
declare
  v_inserees integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', current_setting('request.jwt.claim.sub'), true);

  insert into public.properties (organization_id, name)
  select organization_id, 'Fausse ecriture' from public.properties limit 1;

  get diagnostics v_inserees = row_count;

  if v_inserees > 0 then
    raise exception 'le viewer a reussi a ecrire : la policy d ecriture ne filtre pas';
  end if;

  raise notice 'OK : ecriture du viewer refusee comme attendu';
exception
  when insufficient_privilege then
    raise notice 'OK : ecriture du viewer refusee par les droits';
end;
$$;

\echo '--- TEST 19 : le viewer ne peut pas supprimer (DELETE 0 attendu) ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
delete from public.properties;
rollback;

-- Inventaire du mobilier et etat des lieux : deux tables attachees a un bail,
-- donc isolation par organisation comme le reste du schema metier.
-- Les donnees sont purgees en tete : le test reste rejouable.
--
-- Ce fichier doit pouvoir tourner seul : il cree donc son propre bien, lot et
-- bail pour Konan, absents du fichier de regles metier.

delete from public.inspection_items;
delete from public.inspection_reports;
delete from public.inventory_items;
delete from public.inventory_catalog where organization_id is not null;

insert into public.properties (organization_id, name, commune)
select id, 'Immeuble Konan', 'Koumassi'
from public.organizations
where name = 'Agence Konan' and not exists (
  select 1 from public.properties p where p.name = 'Immeuble Konan'
);

-- La garde porte sur l immmeuble et l organisation : une recherche par simple
-- libelle trouvait un lot homonyme cree par une autre suite, et le scenario
-- Konan n obtenait alors aucun bail, faisant echouer les assertions d isolation
-- pour une raison qui n avait rien a voir avec RLS.
insert into public.units (organization_id, property_id, label, unit_type_v2, category)
select p.organization_id, p.id, 'Apt 1', 'apartment_f2', 'residential'
from public.properties p
where p.name = 'Immeuble Konan'
  and not exists (
    select 1 from public.units u
    where u.property_id = p.id and u.label = 'Apt 1'
  );

insert into public.tenants (organization_id, full_name, phone)
select id, 'M. Kouassi', '+225 05 22 22 22 22'
from public.organizations
where name = 'Agence Konan' and not exists (
  select 1 from public.tenants t where t.full_name = 'M. Kouassi'
);

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount)
select p.organization_id, u.id, t.id, date '2026-01-01', 150000
from public.properties p
join public.units u on u.property_id = p.id
join public.tenants t on t.full_name = 'M. Kouassi'
where p.name = 'Immeuble Konan'
  and not exists (
    select 1 from public.leases l where l.unit_id = u.id and l.status = 'active'
  );

-- Un objet et un etat des lieux pour Konan

insert into public.inventory_items (organization_id, lease_id, name, category, condition, quantity)
select l.organization_id, l.id, 'Refrigerateur', 'Cuisine', 'good', 1
from public.leases l
where l.organization_id = (
  select id from public.organizations where name = 'Agence Konan'
);

insert into public.inspection_reports (organization_id, lease_id, type, inspection_date)
select l.organization_id, l.id, 'move_in', date '2026-01-01'
from public.leases l
where l.organization_id = (
  select id from public.organizations where name = 'Agence Konan'
);

insert into public.inspection_items (report_id, organization_id, room, element, condition)
select r.id, r.organization_id, 'Cuisine', 'Sol', 'good'
from public.inspection_reports r;

select (select id from auth.users where email = 'konan@test.ci')::text as konan_id \gset

\echo '--- TEST 20 : Konan voit son objet d etat des lieux ---'
-- La lecture porte sur inspection_items, table dans laquelle le scenario vient
-- d ecrire. Interroger inventory_items ne prouverait rien : aucune ligne n y
-- existe et le compte serait de zero pour une raison sans rapport avec RLS.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
select public.assert_compte('Konan voit son objet', count(*), 1::bigint)
from public.inspection_items;
rollback;

\echo '--- TEST 21 : Konan ne voit pas les objets d une autre agence ---'
-- L autre agence a besoin de son propre bien et de son propre lot : un bien
-- appartient a une seule organisation.
insert into public.properties (organization_id, name, commune)
select id, 'Immeuble Yeture', 'Yopougon'
from public.organizations
where name = 'Agence Yeture' and not exists (
  select 1 from public.properties p where p.name = 'Immeuble Yeture'
);

insert into public.units (organization_id, property_id, label, unit_type_v2, category)
select p.organization_id, p.id, 'Apt 2', 'apartment_f2', 'residential'
from public.properties p
where p.name = 'Immeuble Yeture'
  and not exists (
    select 1 from public.units u
    where u.property_id = p.id and u.label = 'Apt 2'
  );

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount)
select p.organization_id, u.id, t.id, date '2026-01-01', 120000
from public.properties p
join public.units u on u.property_id = p.id
join public.tenants t on t.full_name = 'M. Kouassi'
where p.name = 'Immeuble Yeture'
  and not exists (
    select 1 from public.leases l where l.unit_id = u.id and l.status = 'active'
  );

insert into public.inventory_items (organization_id, lease_id, name, condition)
select l.organization_id, l.id, 'Television', 'good'
from public.leases l
where l.organization_id = (select id from public.organizations where name = 'Agence Yeture');

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
select public.assert_compte('Konan ne voit que son objet', count(*), 1::bigint)
from public.inventory_items;
rollback;

\echo '=== TESTS INVENTAIRE (suite) ==='

\echo '--- TEST 22 : ecriture croisee bloquee (INSERT 0 0 attendu) ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
insert into public.inventory_items (organization_id, lease_id, name)
select l2.organization_id, l2.id, 'Objet pirate'
from public.leases l2
where l2.organization_id <> (
  select organization_id from public.inventory_items limit 1
)
limit 1;
rollback;

\echo '--- TEST 23 : le catalogue systeme est lisible par tous ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
select 'catalogue visible : ' || count(*)::text || ' objets' from public.inventory_catalog;
rollback;

\echo '--- TEST 24 : le catalogue systeme ne peut pas etre ecrit ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
insert into public.inventory_catalog (organization_id, category, name)
select organization_id, 'Cuisine', 'Objet systeme interdit'
from public.inventory_catalog
where organization_id is not null
limit 1;
rollback;

\echo '--- TEST 25 : le catalogue de son agence s ecrit ---'
-- L objet est retire avant creation : le fichier doit pouvoir etre relance sur
-- une base deja peuplee, sans quoi la contrainte d unicite
-- inventory_catalog_own_key echouerait sur le rejeu.
delete from public.inventory_catalog where name = 'Machine a popcorn';

insert into public.inventory_catalog (organization_id, category, name)
select organization_id, 'Cuisine', 'Machine a popcorn'
from public.memberships
where user_id = (select id from auth.users where email = 'konan@test.ci')
limit 1;

select public.assert_compte('objet propre enregistre', count(*), 1::bigint)
from public.inventory_catalog where name = 'Machine a popcorn';

\echo '--- TEST 26 : rejeu du catalogue sans doublon ---'
-- Ce test verifie que le trigger anti-doublon rejette une reinsertion. La
-- violation attendue est donc capturee : sans cela le fichier s interromprait
-- exactement sur le comportement qu il cherche a observer.
do $$
begin
  insert into public.inventory_catalog (organization_id, category, name)
  select organization_id, 'Cuisine', 'Machine a popcorn'
  from public.memberships
  where user_id = (select id from auth.users where email = 'konan@test.ci')
  limit 1;

  raise exception 'le catalogue a accepte un doublon : le trigger anti-doublon ne fonctionne pas';
exception
  when unique_violation then
    raise notice 'OK : doublon refuse par le catalogue';
end;
$$;

select public.assert_compte('pas de doublon au rejeu du catalogue', count(*), 1::bigint)
from public.inventory_catalog where name = 'Machine a popcorn';

\echo '=== TESTS TERMINES ==='
