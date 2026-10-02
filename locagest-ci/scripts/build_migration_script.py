"""Assemble le script de migration 2 a coller dans le SQL Editor de Supabase.

Rajoute un en-tete explicatif et une requete de verification autour du fichier
de migration versionne, qui reste la source de verite.
"""

from pathlib import Path

RACINE = Path(__file__).resolve().parents[1]
DOSSIER = RACINE / "supabase" / "migrations"
MIGRATIONS = sorted(DOSSIER.glob("*.sql"))
SUITES = sorted((RACINE / "supabase" / "tests").glob("*.test.sql"))
SORTIE = RACINE / "supabase" / "MIGRATION_2_A_COLLER.sql"

ENTETE = """-- ===========================================================================
-- LOCAGEST CI - Script complet de migration
-- A coller dans Supabase > SQL Editor > New query > Run
--
-- Sources de verite (dans l'ordre) :
{migrations}
--
-- Chaque migration est idempotente : le script peut etre relance sans risque.
-- Le fichier versionne reste la source de verite, ce script n en est qu un
-- assemblage : toute correction se fait dans supabase/migrations/.
--
-- ETAPE 1 - verifier que rien n existe encore, ou que seule la migration 1
-- est posee. Cette requete doit renvoyer 0 sur une base vierge, ou 2 si le
-- socle agence etait deja en place.
select count(*) as "migrations prealables (attendu 0 ou 2)"
from pg_tables
where schemaname = 'public'
  and tablename in ('organizations', 'memberships');

-- ===========================================================================

"""

PIED = """

-- ===========================================================================
-- VERIFICATION : a lancer apres la migration
-- Resultat attendu :  15 | 49 | 19 | 77 | 3 | 1 | 1 | 4 | 3
--
-- soit 15 tables, 49 policies, 19 triggers, 77 objets au catalogue,
-- 3 enums d etat des lieux, 1 type de bien detaille, 1 contrainte de
-- correspondance, 4 colonnes de reglage du bail (prorata_mode,
-- prorata_basis, revision_rate, revision_allowed_at), et 3 colonnes de
-- paiement (reference, status, rejection_reason).
--
-- Ces nombres sont releves sur une base reellement construite, pas comptes a
-- la main : c est la seule facon de ne pas publier une attente fausse.
-- ===========================================================================
select
  (select count(*) from pg_tables where schemaname = 'public')
  || ' | ' || (select count(*) from pg_policies where schemaname = 'public')
  || ' | ' || (select count(*) from information_schema.triggers
                where trigger_schema = 'public')
  || ' | ' || (select count(*) from public.inventory_catalog
                where organization_id is null)
  || ' | ' || (select count(*) from pg_type
                where typname in ('item_condition', 'inspection_type', 'inspection_status'))
  || ' | ' || (select count(*) from pg_type where typname = 'unit_type_v2')
  || ' | ' || (select count(*) from pg_constraint
                where conname = 'units_type_matches_category')
  || ' | ' || (select count(*) from information_schema.columns
                where table_schema = 'public' and table_name = 'leases'
                  and column_name in ('prorata_mode', 'prorata_basis',
                                      'revision_rate', 'revision_allowed_at'))
  || ' | ' || (select count(*) from information_schema.columns
                where table_schema = 'public' and table_name = 'payments'
                  and column_name in ('reference', 'status', 'rejection_reason'))
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
