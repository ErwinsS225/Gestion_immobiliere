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

select
  case when count(*) = 0 then 'OK Konan ne voit AUCUNE propriete de Yeture'
       else 'ECHEC fuite de donnees : ' || count(*)::text end as resultat
from public.properties where name = 'Immeuble Yeture';

select
  case when count(*) = 1 then 'OK Konan voit la sienne'
       else 'ECHEC ' || count(*)::text end as resultat
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
-- anon n a meme pas le droit SELECT : le refus est anterieur a RLS.
begin;
set local role anon;
select count(*) from public.properties;
rollback;

\echo '--- TEST 16 : subscription_payments inaccessible a authenticated ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
select count(*) from public.subscription_payments;
rollback;

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

\echo '--- TEST 18 : le viewer ne peut pas ecrire (INSERT 0 0 attendu) ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
insert into public.properties (organization_id, name)
select organization_id, 'Fausse ecriture' from public.properties limit 1;
rollback;

\echo '--- TEST 19 : le viewer ne peut pas supprimer (DELETE 0 attendu) ---'
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'konan_id', true);
delete from public.properties;
rollback;

\echo '=== TESTS TERMINES ==='
