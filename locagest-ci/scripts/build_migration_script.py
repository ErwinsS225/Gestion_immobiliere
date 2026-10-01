"""Assemble le script de migration 2 a coller dans le SQL Editor de Supabase.

Rajoute un en-tete explicatif et une requete de verification autour du fichier
de migration versionne, qui reste la source de verite.
"""

from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
MIGRATION = RACINE / "supabase" / "migrations" / "20261001000100_create_business_schema.sql"
SORTIE = RACINE / "supabase" / "MIGRATION_2_A_COLLER.sql"

ENTETE = """-- ===========================================================================
-- LOCAGEST CI - Migration 2 : schema metier
-- A coller dans Supabase > SQL Editor > New query > Run
--
-- Source de verite : supabase/migrations/20261001000100_create_business_schema.sql
--
-- Cette migration est idempotente : elle peut etre relancee sans risque.
--
-- ETAPE 1 - verifier que la migration 1 est deja en place.
-- Cette requete doit renvoyer 2 avant de continuer.
select count(*) as "migrations prealables (attendu 2)"
from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'memberships');

-- ===========================================================================

"""

PIED = """

-- ===========================================================================
-- VERIFICATION : a lancer apres la migration
-- Resultat attendu :  9 | 33 | 14
-- ===========================================================================
select
  (select count(*) from pg_tables
    where schemaname = 'public'
      and tablename in ('profiles','owners','properties','units','tenants',
                        'leases','rent_calls','payments','subscription_payments'))
  || ' | ' || (select count(*) from pg_policies where schemaname = 'public')
  || ' | ' || (select count(*) from information_schema.triggers
                where trigger_schema = 'public')
  as "tables | policies | triggers (attendu 9 | 33 | 14)";
"""


def main() -> None:
    corps = MIGRATION.read_text(encoding="utf-8")
    SORTIE.write_text(ENTETE + corps + PIED, encoding="utf-8")
    print(f"{SORTIE.relative_to(RACINE)} : {len(SORTIE.read_text().splitlines())} lignes")


if __name__ == "__main__":
    main()
