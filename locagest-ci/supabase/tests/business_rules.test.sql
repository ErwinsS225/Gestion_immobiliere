-- Test fonctionnel des regles metier de la migration 2.
-- S'execute en role postgres (contourne RLS) pour verifier d'abord la logique,
-- puis la separation des roles est verifiee dans rls_isolation.test.sql.

\set ON_ERROR_STOP on

-- --------------------------------------------------------------------
-- Mise en place : une agence, un proprietaire, une propriete, un lot,
-- un locataire, un bail actif.
--
-- Nettoyage prealable : le fichier doit pouvoir etre relance sur une base
-- deja peuplee. Les suppressions suivent les cascades declarees.
-- --------------------------------------------------------------------

delete from public.payments;
delete from public.rent_calls;
delete from public.leases;
delete from public.tenants;
delete from public.units;
delete from public.properties;
delete from public.owners;
delete from public.memberships;
delete from public.organizations;
delete from auth.users;

insert into public.organizations (name, city)
values ('Agence Kouassi', 'Abidjan');

insert into auth.users (email, raw_user_meta_data)
values ('kouassi@test.ci', '{"full_name":"M. Kouassi","phone":"+225 05 22 22 22 22"}'::jsonb);

insert into public.memberships (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u, public.organizations o
where u.email = 'kouassi@test.ci'
limit 1;

create temporary table ctx as
select
  (select id from public.organizations limit 1) as org_id,
  (select id from auth.users limit 1) as user_id;

insert into public.owners (organization_id, full_name, phone)
select org_id, 'M. Yao', '+225 07 11 11 11 11' from ctx;

insert into public.properties (organization_id, owner_id, name, address, commune)
select org_id, (select id from public.owners limit 1), 'Residence Les Palmiers',
  'Rue des Jardins', 'Cocody'
from ctx;

insert into public.units (organization_id, property_id, label, unit_type, surface_area, room_count, base_rent, charges)
select org_id, (select id from public.properties limit 1), 'Apt 3B', 'apartment', 85, 3, 150000, 10000
from ctx;

insert into public.tenants (organization_id, full_name, phone, whatsapp)
select org_id, 'M. Kouassi', '+225 05 22 22 22 22', '+225 05 22 22 22 22' from ctx;

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, charges_amount, deposit_amount, payment_day)
select ctx.org_id,
  (select id from public.units limit 1),
  (select id from public.tenants limit 1),
  date '2026-01-01', 150000, 10000, 300000, 5
from ctx;

\echo '--- TEST 1 : total_amount calcule automatiquement a l insertion ---'
insert into public.rent_calls (organization_id, lease_id, period_year, period_month, due_date, rent_amount, charges_amount)
select ctx.org_id, (select id from public.leases limit 1), 2026, 3,
  (current_date + 20), 150000, 10000
from ctx;

select public.assert_vrai('le total de l echeance est calcule', total_amount = 160000)
from public.rent_calls;

\echo '--- TEST 2 : aucun paiement -> pending ---'
select public.assert_vrai('aucun paiement laisse l echeance en attente',
  status = 'pending' and amount_paid = 0)
from public.rent_calls;

\echo '--- TEST 3 : paiement partiel sur echeance NON echue -> partial ---'
-- L echeance du mois 3 a ete creee au TEST 1 avec une date lointaine : le
-- test reste valable quelle que soit la date d execution.
insert into public.payments (organization_id, rent_call_id, amount, method)
select c.org_id, rc.id, 60000, 'wave' from public.rent_calls rc, ctx c
where rc.period_month = 3;

select public.assert_vrai('un reglement partiel donne le statut partial',
  status = 'partial' and amount_paid = 60000)
from public.rent_calls where period_month = 3;

\echo '--- TEST 4 : solde -> paid ---'
insert into public.payments (organization_id, rent_call_id, amount, method)
select c.org_id, rc.id, 100000, 'cash' from public.rent_calls rc, ctx c
where rc.period_month = 3;

select public.assert_vrai('l echeance est soldee au montant exact',
  status = 'paid' and amount_paid = 160000)
from public.rent_calls where period_month = 3;

\echo '--- TEST 5 : surpaiement reste paid (montant > total) ---'
insert into public.payments (organization_id, rent_call_id, amount, method)
select c.org_id, rc.id, 10000, 'cash' from public.rent_calls rc, ctx c
where rc.period_month = 3;

select public.assert_vrai('un exces de paiement solde aussi l echeance',
  status = 'paid' and amount_paid = 170000)
from public.rent_calls where period_month = 3;

\echo '--- TEST 6 : suppression des paiements -> retour a pending ---'
delete from public.payments
where rent_call_id = (select id from public.rent_calls where period_month = 3);

select public.assert_vrai('une annulation ramene l echeance en attente',
  status = 'pending' and amount_paid = 0)
from public.rent_calls where period_month = 3;

\echo '--- TEST 7 : mark_overdue_rent_calls bascule les echeances non soldee ---'
insert into public.rent_calls (organization_id, lease_id, period_year, period_month, due_date, rent_amount, charges_amount)
select c.org_id, (select id from public.leases limit 1), 2026, 1,
  (current_date - 10), 150000, 10000
from ctx c;

select 'avant cron : ' || status as etat from public.rent_calls where period_month = 1;

select 'echeances basculees = ' || public.mark_overdue_rent_calls() as resultat;

select public.assert_vrai('une echeance echue de 10 jours passe en retard',
  status = 'overdue')
from public.rent_calls where period_month = 1;

\echo '--- TEST 8 : le cron ne degrade pas une echeance soldee ---'
-- On solde l echeance du mois 3, puis on relance le cron : elle doit rester
-- paid meme si sa date d echeance est depassee de plus de 5 jours.
insert into public.payments (organization_id, rent_call_id, amount, method)
select c.org_id, rc.id, 160000, 'wave' from public.rent_calls rc, ctx c
where rc.period_month = 3;

update public.rent_calls
set due_date = (current_date - 10)
where period_month = 3;

select 'soldee, echue de 10 jours, avant cron : ' || status as etat
from public.rent_calls where period_month = 3;

select 'echeances basculees au 2e cron = ' || public.mark_overdue_rent_calls() as resultat;

select public.assert_vrai('une echeance soldee n est pas degradee en retard',
  status = 'paid')
from public.rent_calls where period_month = 3;

\echo '--- TEST 9 : un lot ne peut avoir qu un seul bail actif ---'
do $$
begin
  insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount)
  select
    (select organization_id from public.leases limit 1),
    (select unit_id from public.leases limit 1),
    (select id from public.tenants limit 1),
    date '2026-05-01', 120000;
  raise notice 'ECHEC : un second bail actif a ete accepte';
exception
  when unique_violation then
    raise notice 'OK : second bail actif refuse (unique_violation)';
end;
$$;

\echo '--- TEST 10 : generate_monthly_rent_calls est idempotente ---'
select '1er appel cree = ' || public.generate_monthly_rent_calls(2026, 6) as resultat;
select '2e appel cree = ' || public.generate_monthly_rent_calls(2026, 6) as resultat;

\echo '--- TEST 11 : generation refuse un mois invalide ---'
do $$
begin
  perform public.generate_monthly_rent_calls(2026, 13);
  raise notice 'ECHEC : mois 13 accepte';
exception
  when invalid_parameter_value then
    raise notice 'OK : mois 13 refuse (22023)';
end;
$$;

\echo '--- TEST 12 : profil cree automatiquement a l inscription ---'
select public.assert_compte('profil cree par le trigger', count(*), 1::bigint)
from public.profiles;
