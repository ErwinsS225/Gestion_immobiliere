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
