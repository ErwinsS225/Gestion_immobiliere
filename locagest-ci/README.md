# Locagest CI

Application web de gestion locative pour les agences immobilières en Côte d’Ivoire.

## Démarrage local

1. Installer les dépendances : `npm install`
2. Copier `.env.example` vers `.env.local` et renseigner l’URL Supabase ainsi que la clé publique anon/publishable.
3. Dans Supabase, activer la confirmation email et ajouter `http://localhost:3000/auth/callback` aux URL de redirection autorisées.
4. Définir `http://localhost:3000` comme URL du site local dans **Authentication → URL Configuration**.
5. Appliquer les migrations dans l’ordre : `supabase/migrations/20261001000000_create_organization_with_owner.sql`, puis `supabase/migrations/20261001000100_create_business_schema.sql`. Avec un compte ayant les droits SQL d’administration, ouvrir **SQL Editor**, coller chaque fichier et l’exécuter. La première crée les agences/memberships et leurs policies RLS ; la seconde crée le schéma métier et ses policies RLS.
6. Lancer `npm run dev` puis ouvrir `http://localhost:3000`.

Les clés Supabase absentes empêchent la connexion, l’inscription et l’accès aux routes protégées. Aucune clé `service_role` n’est utilisée dans l’interface.

## Écrans d’authentification

- `/signup` : création de compte et confirmation obligatoire par email.
- `/login` : connexion email/mot de passe.
- `/forgot-password` : demande de lien de réinitialisation.
- `/reset-password` : choix d’un nouveau mot de passe depuis le lien reçu.
- `/auth/callback` : échange sécurisé du code email contre une session Supabase.
- `/onboarding` : formulaire protégé de création d’agence ; la migration doit être appliquée pour enregistrer l’organisation.
- `POST /api/onboarding` : valide le payload avec Zod, utilise la session courante et appelle la RPC `create_organization_with_owner`.
- `/properties` : crée, affiche et modifie les biens et leurs lots ; permet de sélectionner un propriétaire existant ou d’enregistrer un nouveau propriétaire avec le bien.
- Les formulaires valident les saisies avec Zod côté navigateur et côté serveur. Les écritures utilisent la session Supabase authentifiée et les policies RLS ; aucun `service_role` n’est utilisé.
- Les montants des lots sont saisis en FCFA entiers. Le statut d’occupation est lu depuis la base et ne se modifie pas dans ce formulaire ; il est lié aux baux.

Pour la production, ajouter le domaine déployé à la liste des redirections Supabase et mettre à jour l’URL du site.

## Vérification manuelle

- Une inscription valide affiche la confirmation d’envoi et n’ouvre pas de session avant validation de l’adresse.
- Un lien de confirmation valide crée une session et redirige vers `/onboarding`.
- Une connexion incorrecte affiche une erreur sans exposer les détails du fournisseur.
- Une route protégée redirige un visiteur non connecté vers `/login`.
- Le lien « Mot de passe oublié » envoie un email, puis le lien reçu permet de modifier le mot de passe.
- `/onboarding` n’est plus une 404 ; après connexion, le formulaire d’agence est accessible.
- Après application de la migration, créer une agence et vérifier dans Supabase l’organisation, son membership `owner` et la période d’essai de 30 jours.
- Après application des deux migrations, créer un bien avec et sans propriétaire, puis vérifier sa présence dans `properties` et, le cas échéant, `owners` avec le bon `owner_id`.
- Ajouter un lot (libellé, type, surface, pièces, loyer et charges), vérifier ses valeurs dans `units`, puis modifier le lot et le bien. Vérifier qu’un libellé de lot en doublon affiche un message explicite et que le statut d’occupation reste en lecture seule.
- Tester une session visiteur, un rôle `viewer`, un payload invalide et une erreur réseau : l’accès doit être refusé ou expliqué clairement et les valeurs saisies doivent rester disponibles après échec.

Le tableau de bord, les locataires, les baux et les paiements restent à construire. La redirection vers `/dashboard` après l’onboarding présente les premiers indicateurs du patrimoine enregistré.

## Tests SQL rejouables

Les règles métier et l’isolation multi-tenant sont vérifiées par des tests SQL qui
se rejouent sur un Postgres local, sans dépendre du projet Supabase.

```bash
docker run -d --name loca_pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=locagest \
  -p 55432:5432 postgres:17-alpine

# Reproduit l'environnement Supabase (rôles, schéma auth, auth.uid())
docker cp supabase/tests/00_local_scaffold.sql loca_pg:/tmp/f.sql
docker exec loca_pg psql -U postgres -d locagest -v ON_ERROR_STOP=1 -f /tmp/f.sql

# Puis les migrations, dans l'ordre
for f in supabase/migrations/*.sql; do
  docker cp "$f" loca_pg:/tmp/f.sql
  docker exec loca_pg psql -U postgres -d locagest -v ON_ERROR_STOP=1 -f /tmp/f.sql
done

# Puis les tests : 11 règles métier, 8 contrôles d'isolation
for f in supabase/tests/business_rules.test.sql supabase/tests/rls_isolation.test.sql; do
  docker cp "$f" loca_pg:/tmp/f.sql
  docker exec loca_pg psql -U postgres -d locagest -f /tmp/f.sql
done
```

`business_rules.test.sql` vérifie le calcul du total, la bascule de statut
`pending / partial / paid / overdue`, la bascule J+5 par `mark_overdue_rent_calls`,
l’unicité du bail actif par lot et l’idempotence de la génération mensuelle.

`rls_isolation.test.sql` prouve qu’une agence ne voit ni ne peut écrire chez une
autre. Il encadre chaque scénario par `BEGIN` / `ROLLBACK`, car `SET LOCAL` n’a
d’effet que dans une transaction, et récupère les identifiants via `\gset` avant de
basculer le rôle, le rôle `authenticated` n’ayant pas le droit de lire `auth.users`.

## Script de migration pour le SQL Editor

`supabase/MIGRATION_2_A_COLLER.sql` est prêt à coller dans **Supabase → SQL Editor**.
Il contient les trois migrations dans l’ordre. Le contrôle initial doit renvoyer `0`
(base vierge) ou `2` (migration 1 déjà appliquée) ; la vérification finale doit
renvoyer `11 | 33 | 14 | 1 | 1`. Le fichier est généré depuis les migrations
versionnées, qui restent la source de vérité :

```bash
python3 scripts/build_migration_script.py
```

## Typologie des biens

`lib/property-types.ts` définit 7 catégories et 47 types de biens, de `studio` à
`parking`, en passant par `office_floor`, `warehouse` ou `villa_furnished`. Le
formulaire des lots affiche les champs selon la catégorie : un studio ne propose
pas de hauteur sous plafond, un entrepôt n'affiche pas de nombre de chambres.

La correspondance catégorie ↔ type est imposée **en base** par la contrainte
`units_type_matches_category` : une requête directe ou un import ne peut pas créer
un type incohérent. La conversion depuis l'ancien enum à 5 valeurs est déjà faite
par la migration 3 (`apartment → apartment_f2`, `office → office_single`, etc.).

Les attributs peu consultés (chambres, salles de bain, vitrine, hauteur, référence
cadastrale…) sont rangés dans la colonne `metadata` en JSONB : le schéma reste stable
quand de nouveaux types apparaissent.


```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```
