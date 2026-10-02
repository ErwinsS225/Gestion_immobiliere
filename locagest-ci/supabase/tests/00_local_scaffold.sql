-- Scaffold local : reproduit ce que Supabase fournit deja (roles, schema auth,
-- auth.uid(), auth.users) afin de rejouer les migrations sur un Postgres nu.
--
-- Reserve au developpement local. Ne jamais executer sur le projet Supabase.

create schema if not exists auth;

do $$ begin create role anon nologin; exception when duplicate_object then null; end; $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end; $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end; $$;

-- La colonne id porte une valeur par defaut gen_random_uuid() : sans elle, un
-- insert qui ne fournit pas d identifiant echoue, et le conteneur de test
-- diverge alors de Supabase ou cette fonction existe deja.
create extension if not exists pgcrypto;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Si la table existait deja sans cette valeur par defaut, on la corrige :
-- CREATE TABLE IF NOT EXISTS ne modifie pas une table deja presente.
alter table auth.users alter column id set default gen_random_uuid();

-- Supabase expose le claim sub du JWT dans ce parametre de session.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    pg_catalog.current_setting('request.jwt.claim.sub', true),
    ''
  )::uuid;
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Assertions bloquantes
--
-- Les tests affichaient jusqu ici un libelle « OK » ou « ECHEC » sans jamais
-- interrompre le script. Une isolation multi-tenant cassee passait donc pour
-- un succes, et la suite ne protegeait rien.
--
-- assert_compte compare un nombre, assert_vrai une condition : toutes deux
-- leve une exception, ce qui fait echouer le fichier sous ON_ERROR_STOP.
-- Le detail de l echec est conserve pour un rapport ulterieur.
-- ---------------------------------------------------------------------------

create table if not exists public.assert_echecs (
  ordre serial primary key,
  libelle text not null,
  attendu text not null,
  obtenu text not null,
  constate_le timestamptz not null default now()
);

-- Les tests basculent le role en authenticated. Sans cette politique, l ecriture
-- dans la table d echec serait refusee et masquerait la cause reelle derriere
-- une erreur de permission. L usage est limite au role de test local.
drop policy if exists assert_echecs_admin on public.assert_echecs;
create policy assert_echecs_admin on public.assert_echecs
  for all to public using (true) with check (true);

-- Le type des deux arguments est impose en bigint : un litteral entier est
-- integer, et PostgreSQL ne transtype pas implicitement a l appel, ce qui
-- interromprait la suite sur un simple 0 ou 1.
create or replace function public.assert_compte(
  libelle text,
  obtenu bigint,
  attendu bigint
) returns void
language plpgsql
as $$
declare
  v_obtenu bigint;
  v_attendu bigint;
begin
  v_obtenu := obtenu;
  v_attendu := attendu;

  if v_obtenu is distinct from v_attendu then
    insert into public.assert_echecs (libelle, attendu, obtenu)
    values (libelle, v_attendu::text, v_obtenu::text);
    raise exception 'ECHEC : % (attendu %, obtenu %)', libelle, v_attendu, v_obtenu
      using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.assert_vrai(
  libelle text,
  condition boolean
) returns void
language plpgsql
as $$
begin
  if condition is not true then
    insert into public.assert_echecs (libelle, attendu, obtenu)
    values (libelle, 'vrai', 'faux');
    raise exception 'ECHEC : % (attendu vrai, obtenu faux)', libelle
      using errcode = 'P0001';
  end if;
end;
$$;

-- Les tests negatifs sont ecrits sous forme de blocs DO qui interceptent
-- l exception attendue : sous ON_ERROR_STOP, laisser remonter l erreur ferait
-- echouer le script sur le comportement meme que l on cherche a observer, et
-- l ignorer ne prouverait rien. Le bloc leve au contraire si l operation
-- reussit, ce qui transforme un test negatif en test bloquant.

-- Les droits viennent apres la creation : un GRANT sur une table inexistante
-- interromp le script et empeche les fonctions d etre declarees.
-- Les tests basculent le role en authenticated, il doit donc pouvoir consigner
-- un echec, sans quoi la cause reelle serait masquee par une erreur de droit.
grant all on public.assert_echecs to anon, authenticated, service_role;
grant usage, select on sequence public.assert_echecs_ordre_seq to anon, authenticated, service_role;
grant execute on function public.assert_compte(text, bigint, bigint) to anon, authenticated, service_role;
grant execute on function public.assert_vrai(text, boolean) to anon, authenticated, service_role;
