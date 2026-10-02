-- Reglements : references, statuts et effet sur l encaisse.
--
-- Depend de la migration 7. Les regles verifiees ici sont celles qui protegent
-- l encaisse : une operation rejetee par l operateur ne doit jamais diminuer le
-- total encaisse d une somme qui n a jamais ete recue.

delete from public.payments;
delete from public.rent_calls;
delete from public.leases;
delete from public.units where property_id in (
  select id from public.properties where name = 'Immeuble Reglement'
);
delete from public.properties where name = 'Immeuble Reglement';
delete from public.tenants where full_name = 'M. Reglement';
delete from public.organizations where name = 'Agence Reglement';
delete from auth.users where email = 'reglement@test.ci';

insert into public.organizations (name, city) values ('Agence Reglement', 'Abidjan');
insert into auth.users (email, raw_user_meta_data)
  values ('reglement@test.ci', '{"full_name":"M. Reglement"}'::jsonb);
insert into public.memberships (user_id, organization_id, role)
select u.id, o.id, 'owner'
from auth.users u, public.organizations o
where u.email = 'reglement@test.ci';

insert into public.properties (organization_id, name)
select id, 'Immeuble Reglement' from public.organizations where name = 'Agence Reglement';
insert into public.units (organization_id, property_id, label, unit_type_v2, category)
select p.organization_id, p.id, 'Apt 1', 'apartment_f2', 'residential'
from public.properties p where p.name = 'Immeuble Reglement';
insert into public.tenants (organization_id, full_name, phone)
select id, 'M. Reglement', '+225 07 00 00 00 00'
from public.organizations where name = 'Agence Reglement';

insert into public.leases (organization_id, unit_id, tenant_id, start_date, rent_amount, charges_amount)
select p.organization_id, u.id, t.id, date '2026-10-01', 150000, 10000
from public.properties p
join public.units u on u.property_id = p.id
join public.tenants t on t.full_name = 'M. Reglement'
where p.name = 'Immeuble Reglement';

insert into public.rent_calls (organization_id, lease_id, period_year, period_month, due_date, rent_amount, charges_amount)
select l.organization_id, l.id, 2026, 10, (current_date + 20), 150000, 10000
from public.leases l
where l.start_date = date '2026-10-01';

-- La table temporaire est recreee apres chaque \echo : psql valide implicitement
-- avant chaque echo, ce qui detruit les tables temporaires de la session.
-- Les instructions resolvent l echeance par sous requete plutot que par une
-- table temporaire : psql valide implicitement avant chaque \echo, ce qui
-- detruit les tables temporaires de la session.

\echo '--- TEST 36 : un reglement simule est confirme et solde l echeance ---'
insert into public.payments (organization_id, rent_call_id, amount, method, reference, status)
select o.id, (select id from public.rent_calls limit 1), 160000, 'wave',
       'WVW-20261015-4127', 'confirmed'
from public.organizations o
where exists (select 1 from public.rent_calls);

select
  case when status = 'paid' and amount_paid = 160000
    then 'OK echeance soldee par un reglement confirme'
    else 'ECHEC ' || status || ' / ' || amount_paid end as resultat
from public.rent_calls;

\echo '--- TEST 37 : un rejet sans motif est refuse ---'
insert into public.payments (organization_id, rent_call_id, amount, method, reference, status, rejection_reason)
select o.id, (select id from public.rent_calls limit 1), 0, 'wave',
       'WVW-20261015-4128', 'rejected', null
from public.organizations o
where exists (select 1 from public.rent_calls);

\echo '--- TEST 38 : un rejet porte un motif ---'
insert into public.payments (organization_id, rent_call_id, amount, method, reference, status, rejection_reason)
select o.id, (select id from public.rent_calls limit 1), 0, 'wave',
       'WVW-20261015-4128', 'rejected', 'Fonds insuffisants'
from public.organizations o
where exists (select 1 from public.rent_calls);

select
  case when count(*) = 1 then 'OK rejet enregistre'
       else 'ECHEC ' || count(*)::text end as resultat
from public.payments where status = 'rejected' and amount = 0;

\echo '--- TEST 39 : un rejet ne diminue PAS l encaisse ---'
select
  case when amount_paid = 160000 and status = 'paid'
    then 'OK encaisse inchangee apres rejet'
    else 'ECHEC encaisse = ' || amount_paid || ' / ' || status end as resultat
from public.rent_calls;

\echo '--- TEST 40 : une reference mal formee est refusee ---'
insert into public.payments (organization_id, rent_call_id, amount, method, reference, status)
select o.id, (select id from public.rent_calls limit 1), 1000, 'wave',
       'pas-une-reference', 'confirmed'
from public.organizations o
where exists (select 1 from public.rent_calls);

\echo '--- TEST 41 : une reference en doublon est refusee ---'
insert into public.payments (organization_id, rent_call_id, amount, method, reference, status)
select o.id, (select id from public.rent_calls limit 1), 1000, 'wave',
       'WVW-20261015-4127', 'confirmed'
from public.organizations o
where exists (select 1 from public.rent_calls);

\echo '--- TEST 42 : une operation en attente ne compte pas dans l encaisse ---'
delete from public.payments where status = 'confirmed';

insert into public.payments (organization_id, rent_call_id, amount, method, reference, status)
select o.id, (select id from public.rent_calls limit 1), 160000, 'wave',
       'ORM-20261015-4130', 'pending'
from public.organizations o
where exists (select 1 from public.rent_calls);

select
  case when amount_paid = 0 and status = 'pending'
    then 'OK une operation en attente ne solde pas l echeance'
    else 'ECHEC encaisse = ' || amount_paid || ' / ' || status end as resultat
from public.rent_calls;

\echo '--- TEST 43 : la confirmation de l operation solde l echeance ---'
update public.payments set status = 'confirmed' where status = 'pending';

select
  case when amount_paid = 160000 and status = 'paid'
    then 'OK le passage a confirme solde l echeance'
    else 'ECHEC encaisse = ' || amount_paid || ' / ' || status end as resultat
from public.rent_calls;

\echo '=== TESTS REGLEMENTS TERMINES ==='