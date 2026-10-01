"""Assemble le script de migration 2 a coller dans le SQL Editor de Supabase.

Rajoute un en-tete explicatif et une requete de verification autour du fichier
de migration versionne, qui reste la source de verite.
"""

from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOSSIER = RACINE / "supabase" / "migrations"
MIGRATIONS = sorted(DOSSIER.glob("*.sql"))
SORTIE = RACINE / "supabase" / "MIGRATION_2_A_COLLER.sql"

ENTETE = """-- ===========================================================================
-- LOCAGEST CI - Migrations 1 a 3
-- A coller dans Supabase > SQL Editor > New query > Run
--
-- Sources de verite (dans l'ordre) :
{migrations}
--
-- Chaque migration est idempotente : le script peut etre relance sans risque.
--
-- ETAPE 1 - verifier que rien n existe encore, ou que la migration 1 est posee.
-- Cette requete doit renvoyer 0 sur une base vierge, ou 2 si la migration 1
-- a deja ete appliquee.
select count(*) as "migrations prealables (attendu 0 ou 2)"
from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'memberships');

-- ===========================================================================

"""

PIED = """

-- ===========================================================================
-- VERIFICATION : a lancer apres la migration
-- Resultat attendu :  11 | 33 | 14   puis   47 | 1
-- soit 11 tables, 33 policies, 14 triggers, 47 types de bien, 1 contrainte
-- de correspondance categorie / type.
-- ===========================================================================
select
  (select count(*) from pg_tables where schemaname = 'public')
  || ' | ' || (select count(*) from pg_policies where schemaname = 'public')
  || ' | ' || (select count(*) from information_schema.triggers
                where trigger_schema = 'public')
  || ' | ' || (select count(*) from pg_type
                where typname = 'unit_type_v2')
  || ' | ' || (select count(*) from pg_constraint
                where conname = 'units_type_matches_category')
  as "verif";
"""

def main() -> None:
    listing = "\n".join(
        f"--   supabase/migrations/{migration.name}" for migration in MIGRATIONS
    )
    corps = "\n".join(migration.read_text(encoding="utf-8") for migration in MIGRATIONS)
    SORTIE.write_text(ENTETE.format(migrations=listing) + corps + PIED, encoding="utf-8")
    print(
        f"{SORTIE.relative_to(RACINE)} : {len(SORTIE.read_text().splitlines())} lignes "
        f"({len(MIGRATIONS)} migrations)"
    )


if __name__ == "__main__":
    main()
