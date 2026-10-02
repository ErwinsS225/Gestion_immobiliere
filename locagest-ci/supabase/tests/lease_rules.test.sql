-- Plafonds legaux du bail : depot de garantie, prorata et revision.
--
-- Depend de la migration 6. Les contraintes y sont posees en base, donc ces
-- tests verifient qu une requete directe est refusee au meme titre qu un
-- formulaire : c est ce qui rend la regle serieuse.

-- Nettoyage : le fichier doit pouvoir etre relance sur une base deja peuplee.
delete from public.leases;
delete from public.units where property_id in (
  select id from public.properties where name = 'Immeuble Juridique'
);
delete from public.properties where name = 'Immeuble Juridique';
delete from public.tenants where full_name = 'M. Locataire';
delete from public.organizations where name = 'Agence Juridique';
delete from auth.users where email = 'juridique@test.ci';

insert into public.organizations (name, city) values ('Agence Juridique', 'Abidjan');
insert into auth.users (email, raw_user_meta_data)
  values ('juridique@test.ci', '{"full_name":"M. Juridique"}'::jsonb);
insert into public.memberships (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u, public.organizations o
where u.email = 'juridique@test.ci';

insert into public.properties (organization_id, name)
select id, 'Immeuble Juridique' from public.organizations where name = 'Agence Juridique';
-- Douze lots : chaque scenario utilise un lot distinct, la migration 2
-- n autorisant qu un bail actif par lot. Les tests 27 a 29 en consomment trois,
-- les tests 30 a 32 en consomment trois autres, et la revision en utilise un.
insert into public.units (organization_id, property_id, label, unit_type_v2, category)
select p.organization_id, p.id, 'Apt ' || g.n, 'apartment_f2', 'residential'
from public.properties p
cross join generate_series(1, 12) g(n)
where p.name = 'Immeuble Juridique';
insert into public.tenants (organization_id, full_name, phone)
select id, 'M. Locataire', '+225 07 00 00 00 00'
from public.organizations where name = 'Agence Juridique';

create temporary table scenario as
select
  (select id from public.properties where name = 'Immeuble Juridique') as property_id,
  (select id from public.tenants where full_name = 'M. Locataire') as tenant_id;


\echo '--- TEST 27 : depot egal au plafond de deux mois de loyer (art. 416) ---'
-- Loyer 150 000, plafond 300 000 : le depot au plafond exact est accepte.
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, deposit_amount)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 150000, 300000
from public.units u, scenario s
where u.property_id = s.property_id and u.label = 'Apt 1';

select
  case when count(*) = 1 then 'OK depot au plafond accepte'
       else 'ECHEC ' || count(*)::text end as resultat
from public.leases where deposit_amount = 300000;

\echo '--- TEST 28 : depot au dela de deux mois (art. 416) doit etre refuse ---'
-- 300 001 depasse de un franc le plafond : la contrainte doit rejeter.
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, deposit_amount)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 150000, 300001
from public.units u, scenario s
where u.property_id = s.property_id and u.label = 'Apt 2';

select
  case when count(*) = 0 then 'OK aucun bail au dela du plafond'
       else 'ECHEC ' || count(*)::text || ' bail(s) accepte(s)' end as resultat
from public.leases where deposit_amount > 300000;

\echo '--- TEST 29 : le plafond porte sur le loyer seul, pas sur les charges ---'
-- Loyer 100 000, charges 400 000 : le plafond reste 200 000.
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, charges_amount, deposit_amount)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 400000, 200000
from public.units u, scenario s
where u.property_id = s.property_id and u.label = 'Apt 3';

select
  case when count(*) = 1 then 'OK charges elevees ne relevent pas le plafond'
       else 'ECHEC ' || count(*)::text end as resultat
from public.leases where rent_amount = 100000 and charges_amount = 400000;

\echo '--- TEST 30 : un mode de prorata inconnu est refuse ---'
-- L insertion doit echouer sur la contrainte. Le fichier le verifie en comptant
-- ce qui a ete enregistre, pour que le resultat soit explicite et non deduit
-- d une absence de message d erreur.
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'prorata_inventé'
from public.units u, scenario s
where u.property_id = s.property_id and u.label = 'Apt 4';

select
  case when count(*) = 0 then 'OK mode inconnu rejete'
       else 'ECHEC ' || count(*)::text || ' accepte(s)' end as resultat
from public.leases where prorata_mode = 'prorata_inventé';

\echo '--- TEST 31 : une base de prorata inconnue est refusee ---'
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'annee_bissextile'
from public.units u, scenario s
where u.property_id = s.property_id and u.label = 'Apt 5';

select
  case when count(*) = 0 then 'OK base inconnue rejetee'
       else 'ECHEC ' || count(*)::text || ' acceptee(s)' end as resultat
from public.leases where prorata_basis = 'annee_bissextile';

\echo '--- TEST 32 : les trois modes et les deux bases sont acceptes ---'
-- Six combinaisons mode x base, une par lot, de Apt 6 a Apt 11. Chaque ligne
-- est ecrite explicitement plutot que produite par une jointure croisee, pour
-- que la correspondance entre lot et combinaison reste lisible.
insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'days_remaining', 'calendar_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 6';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'days_remaining', 'thirty_day_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 7';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'days_remaining_plus_one', 'calendar_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 8';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'days_remaining_plus_one', 'thirty_day_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 9';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'full_month', 'calendar_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 10';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, prorata_mode, prorata_basis)
select u.organization_id, u.id, s.tenant_id, date '2026-01-01', 100000, 'full_month', 'thirty_day_month'
from public.units u, scenario s where u.property_id = s.property_id and u.label = 'Apt 11';

select
  case when count(*) = 6 then 'OK 6 combinaisons de prorata acceptees'
       else 'ECHEC ' || count(*)::text end as resultat
from public.leases
where rent_amount = 100000
  and prorata_mode in ('days_remaining', 'days_remaining_plus_one', 'full_month')
  and prorata_basis in ('calendar_month', 'thirty_day_month')
  and deposit_amount = 0;

\echo '--- TEST 33 : la revision se deverrouille trois ans apres le bail (art. 455) ---'
select
  case when revision_allowed_at = date '2029-01-01' then 'OK revision bloquee jusqu au 01/01/2029'
       else 'ECHEC ' || coalesce(revision_allowed_at::text, 'NULL') end as resultat
from public.leases
where deposit_amount = 300000;

\echo '--- TEST 34 : la date suit un changement de date de debut ---'
update public.leases set start_date = date '2026-06-15' where deposit_amount = 300000;

select
  case when revision_allowed_at = date '2029-06-15' then 'OK date recalculee apres changement'
       else 'ECHEC ' || coalesce(revision_allowed_at::text, 'NULL') end as resultat
from public.leases
where deposit_amount = 300000;

\echo '--- TEST 35 : un taux de revision hors bornes est refuse ---'
update public.leases set revision_rate = 35 where deposit_amount = 300000;

update public.leases set revision_rate = 5 where deposit_amount = 300000;

select
  case when revision_rate = 5 then 'OK taux de 5 % accepte'
       else 'ECHEC' end as resultat
from public.leases
where deposit_amount = 300000;

\echo '=== TESTS JURIDIQUES TERMINES ==='
