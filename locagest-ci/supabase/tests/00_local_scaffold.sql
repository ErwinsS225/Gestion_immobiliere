-- Scaffold local : reproduit ce que Supabase fournit deja (roles, schema auth,
-- auth.uid(), auth.users) afin de rejouer les migrations sur un Postgres nu.
--
-- Reserve au developpement local. Ne jamais executer sur le projet Supabase.

create schema if not exists auth;

do $$ begin create role anon nologin; exception when duplicate_object then null; end; $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end; $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end; $$;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

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
