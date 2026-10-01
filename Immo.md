Voici le **prompt maître**, conçu pour être collé tel quel dans **Cursor, Claude Code, Windsurf ou v0**. Il contient tout le contexte produit, métier, technique et commercial dont l'IA a besoin pour construire l'application de bout en bout sans perdre le fil.
Avant toute modifiction s'inspirer du fichier index.html pour comprendre la structure de l'application.

## ÉTAT D'AVANCEMENT — 01/10/2026 (revue complète du dépôt)

> Cette section a été réécrite après une revue du code. Le journal précédent
> était en retard sur la réalité : `/dashboard` et `/properties` existaient
> déjà mais étaient décrits comme non livrés.

### Vue d'ensemble

| # | Livrable | État | Commentaire |
| --- | --- | --- | --- |
| 1 | Auth UI | ✅ Terminé | 4 écrans + callback + middleware |
| 2 | Onboarding | ✅ Code prêt | Parcours authentifié à valider |
| 3 | Dashboard | 🟡 Coquille | Shell, nav, checklist. **KPI factices** (« À alimenter ») |
| 4 | CRUD Propriétés | 🟡 Partiel | 1 179 lignes : liste, création, édition, lots. Pas de suppression |
| 5-13 | Lots, Locataires, Baux, Échéances, Paiements, PDF, WhatsApp, Facturation | ❌ Non commencés | — |

### Fonctionnalité 1 — Auth UI : réalisée

- `/signup` : nom complet, email, mot de passe ; confirmation par email requise.
- `/login` : connexion et redirection selon la présence d'un membership.
- `/forgot-password` et `/reset-password` : demande puis choix d'un nouveau mot de passe.
- `/auth/callback` : échange du code Supabase contre une session.
- `middleware.ts` : rafraîchit les cookies et protège les routes listées.

Champs validés avec Zod, formulaires avec React Hook Form. Style issu de la
palette forêt/vert citron du prototype `index.html`, écran français, mobile 390 px
sans débordement.

### Fonctionnalité 2 — Onboarding : code prêt, parcours à valider

- `/onboarding` : nom d'agence obligatoire, email en lecture seule, téléphone
  facultatif, ville par défaut `Abidjan`.
- `POST /api/onboarding` : Zod → `auth.getUser()` → `create_organization_with_owner()`.
  Succès `201 { organizationId }` puis redirection vers `/dashboard`.
- Tests locaux : `400` (JSON invalide), `422` (payload invalide), `401` (sans session).

### Fonctionnalité 3 — Dashboard : coquille livrée, données à brancher

`app/dashboard/page.tsx` (240 lignes) : sidebar, badge d'essai calculé depuis
`organizations.trial_ends_at`, 4 cartes KPI, checklist d'accueil, panneau d'alertes.
Redirection vers `/onboarding` si l'utilisateur n'a pas de membership.

**Limite assumée** : les KPI affichent le littéral « À alimenter » et la checklist
reste à `0 / 4`. C'est normal — les tables métier n'existaient pas jusqu'à la
migration 2. Le branchement est l'étape suivante.

### Fonctionnalité 4 — Propriétés et lots : partiellement livrée

1 179 lignes déjà écrites :

- `GET/POST /api/properties`, `PATCH/DELETE /api/properties/[id]`
- `GET/POST /api/properties/[id]/units`, `PATCH/DELETE .../units/[unitId]`
- `app/properties/page.tsx` + `loading.tsx`
- `property-card.tsx`, `property-form.tsx`, `unit-form.tsx`
- `lib/validations/properties.ts` (Zod) et `lib/properties/owner.ts`

La création d'une propriété accepte un propriétaire optionnel, avec création à la
volée dans `owners`. `organization-context.ts` centralise la résolution de
l'organisation courante et renvoie un `503` explicite sur `PGRST204`/`PGRST205`,
c'est-à-dire quand la migration 2 n'est pas appliquée.

### Migration 2 — Schéma métier : écrite et validée, à appliquer

`supabase/migrations/20261001000100_create_business_schema.sql` (820 lignes) :
9 tables, 33 policies RLS, 14 triggers, 30 index.

| Table | Rôle |
| --- | --- |
| `profiles` | créé à l'inscription par trigger sur `auth.users` |
| `owners` | propriétaires de biens |
| `properties`, `units` | patrimoine ; loyer et charges de base |
| `tenants` | locataires, téléphone obligatoire |
| `leases` | loyer/charges **copiés** : une révision de grille ne touche pas l'historique |
| `rent_calls` | échéances mensuelles |
| `payments` | règlements hors plateforme (Wave, OM, MTN, Moov, espèces, virement) |
| `subscription_payments` | **aucun accès `authenticated`**, réservée au webhook CinetPay |

Règles calculées en base : `total_amount = rent + charges`, `amount_paid = somme des
paiements`, bascule automatique `pending / partial / paid / overdue` à J+5. Fonctions
`generate_monthly_rent_calls(année, mois)` (idempotente) et `mark_overdue_rent_calls()`,
réservées au `service_role` pour le cron.

**Application** : coller `locagest-ci/supabase/MIGRATION_2_A_COLLER.sql` dans
**Supabase → SQL Editor**. Le script affiche d'abord un contrôle qui doit renvoyer
`2`, puis une vérification finale qui doit renvoyer `9 | 33 | 14`. Le fichier est
générable avec `python3 scripts/build_migration_script.py`.

### Vérifications effectuées

- `npm run build` : réussi, 15 routes, lint et TypeScript inclus.
- Migrations rejouées sur Postgres 17 : application sans erreur **sur base vide, sur
  base non vide, et en réapplication** (idempotence confirmée).
- `supabase/tests/` : 19 tests SQL rejouables (`business_rules.test.sql`,
  `rls_isolation.test.sql`) avec `00_local_scaffold.sql` reproduisant l'environnement Supabase.
- Isolation multi-tenant **prouvée** (critère de succès n°2 du MVP) : avec deux agences
  distinctes, lecture isolée, écriture croisée bloquée, `anon` sans aucun droit,
  `viewer` en lecture seule.
- Dépôt Git initialisé sur `main` ; `.env.local` exclu, `.env.example` suivi.

### Points signalés, non résolus

- **Aucun dépôt Git distant.** Le dépôt local est initialisé avec trois commits, mais
  aucun `remote` n'est configuré : le travail n'est pas encore sauvegardé hors de cette machine.
- **Migration 2 pas encore appliquée** sur `clmyavrgwcqjyivotbya`. Le CLI Supabase
  échoue toujours sur ce projet (`does not have the necessary privileges`), donc
  l'application passe par le SQL Editor.
- **CLI non lié au projet** : `supabase/config.toml` absent, aucun `supabase db push` possible.
- **Écart de stack** : le document impose Tailwind + shadcn/ui, mais aucun composant
  shadcn n'est installé et tout le style est du CSS maison (`app/globals.css`,
  1 193 lignes). À trancher avant d'ajouter de nouveaux écrans.
- **Clé `service_role` présente dans `.env.local`.** Elle n'est pas `NEXT_PUBLIC_` donc
  elle n'est pas exposée au client, mais elle ne devrait pas rester dans un fichier de développement.
- **Aucune suite de tests automatisés côté application** (ni Vitest ni Jest), alors que
  le document impose un test écrit avant tout calcul métier.
- **2 vulnérabilités npm** (postcss via Next 15.5.27) ; le correctif impose Next 16.
- **Règles métier non définies et donc volontairement absentes du schéma** : prorata d'un
  bail démarrant en cours de mois, révision annuelle du loyer, imputation d'un paiement
  sur plusieurs échéances, régularisation annuelle des charges.

### Prochaine étape

Appliquer la migration 2 sur Supabase, puis brancher les 4 KPI du dashboard sur les
données réelles. Avant d'ouvrir le CRUD des locataires, il faudra trancher les règles
de prorata et d'imputation des paiements.

---

# 🎯 PROMPT MAÎTRE — SaaS de Gestion Immobilière pour la Côte d'Ivoire

## RÔLE ET MISSION

Tu es un développeur full-stack senior qui construit **Locagest CI**, un SaaS B2B de gestion locative destiné aux **agences immobilières et gestionnaires de biens en Côte d'Ivoire**. Ton objectif : livrer un MVP fonctionnel, sécurisé et déployable, qui résout un seul problème critique — **le suivi des loyers, des impayés et la génération des quittances** — pour des agences gérant entre 10 et 200 lots.

Tu travailles en Next.js 15 (App Router) + TypeScript + Supabase + Tailwind + shadcn/ui. Tu ne sors jamais de cette stack sans me demander.

---

## 🎯 BUT DU PRODUIT

**Problème résolu :** Les agences immobilières ivoiriennes gèrent leurs loyers sur Excel et WhatsApp. Elles perdent du temps, oublient des relances, produisent des quittances manuellement, et n'ont aucune vision consolidée de leur trésorerie locative.

**Promesse :** En 3 clics, le gestionnaire sait qui a payé, qui n'a pas payé, et peut relancer chaque locataire en retard par WhatsApp avec un message pré-rempli. La quittance PDF est générée automatiquement dès qu'un paiement est enregistré.

**Ce que le produit N'EST PAS :**

- Pas un encaisseur de loyers (l'argent circule hors plateforme : mobile money, espèces, virement).
- Pas un logiciel de syndic de copropriété.
- Pas un portail locataire (V1 en tout cas).

---

## 👥 UTILISATEURS ET RÔLES

| Rôle        | Qui                                           | Ce qu'il peut faire                                                        |
| ----------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| **owner**   | Dirigeant de l'agence, propriétaire du compte | Tout : gérer les membres, l'abonnement, les biens, les baux, les paiements |
| **manager** | Agent / gestionnaire salarié                  | Tout sauf gérer les membres et l'abonnement                                |
| **viewer**  | Comptable externe, associé                    | Lecture seule                                                              |

**Cible géographique :** Abidjan en priorité (Cocody, Marcory, Plateau, Yopougon, Treichville), puis Bouaké, Yamoussoukro, San-Pédro.

**Contexte culturel et technique :**

- WhatsApp est le canal de communication dominant. Aucune fonctionnalité ne doit s'en passer.
- Mobile money (Wave, Orange Money, MTN, Moov) est le moyen de paiement de référence. La carte bancaire est marginale.
- Les agents travaillent souvent sur smartphone. **Le design doit être mobile-first.**
- La langue de l'interface est **le français**. Les montants sont en **FCFA** (XOF), sans décimales.

---

## 🔄 WORKFLOW COMPLET DE L'APPLICATION

### Phase 1 — Inscription et onboarding

1. Le gestionnaire arrive sur `/signup` et crée un compte (email + mot de passe) via Supabase Auth.
2. Un trigger crée automatiquement une ligne dans `profiles`.
3. Il est redirigé vers `/onboarding` où il renseigne le nom de son agence, son téléphone, sa ville.
4. La fonction RPC `create_organization_with_owner()` crée atomiquement l'organisation + le membership owner.
5. Il arrive sur `/dashboard` avec un état vide et une checklist d'accueil :
   - ✅ Créer ma première propriété
   - ✅ Ajouter un lot
   - ✅ Enregistrer un locataire
   - ✅ Créer un bail
6. Il dispose de **30 jours d'essai gratuit**, sans carte bancaire.

### Phase 2 — Paramétrage du patrimoine

1. **Créer une propriété** (immeuble, villa, résidence) : nom, adresse, commune, propriétaire (optionnel).
2. **Ajouter des lots** dans la propriété : libellé (ex: "Apt 3B"), type (appartement, magasin, bureau, parking, terrain), surface, nombre de pièces, loyer de base, charges.
3. **Enregistrer un locataire** : nom complet, téléphone (obligatoire), WhatsApp (si différent), email, numéro CNI.
4. **Créer un bail** : lier un lot à un locataire, avec date de début, loyer, charges, dépôt de garantie, jour de paiement (1 à 28).

### Phase 3 — Fonctionnement mensuel (le cœur du produit)

**Le 1er de chaque mois à 6h (heure d'Abidjan) :**

- Un cron Vercel appelle `/api/cron/generate-rent-calls`.
- La fonction Postgres `generate_monthly_rent_calls(year, month)` parcourt tous les baux actifs et crée une ligne dans `rent_calls` pour chacun.
- Chaque échéance a un statut `pending`.

**Le gestionnaire ouvre son dashboard :**

- Il voit en un coup d'œil : **attendu ce mois**, **encaissé**, **impayés**, **taux d'occupation**.
- Il voit la liste des échéances du mois, triées par statut puis par date d'échéance.

**Quand un locataire paie (hors plateforme) :**

1. Le gestionnaire clique sur l'échéance → **"Enregistrer un paiement"**.
2. Il saisit : montant reçu, méthode (Wave / OM / MTN / Moov / espèces / virement), référence, date.
3. Un trigger Postgres recalcule automatiquement `amount_paid` et bascule le statut (`partial` ou `paid`).
4. Dès que le statut passe à `paid`, l'application génère une **quittance PDF** avec `@react-pdf/renderer` et l'envoie automatiquement par email au locataire via Resend.
5. Le gestionnaire peut aussi envoyer la quittance par WhatsApp manuellement (lien `wa.me`).

**Quand un locataire ne paie pas :**

- À J+5 après l'échéance, l'échéance passe en `overdue`.
- Le dashboard affiche une alerte : "X loyers en retard ce mois-ci".
- Pour chaque retard, le gestionnaire voit un bouton **"Relancer par WhatsApp"**.
- Ce bouton ouvre `https://wa.me/225XXXXXXXX?text=<message pré-rempli>` avec un message du type :
  > "Bonjour M. Kouassi, nous n'avons pas encore reçu votre loyer de septembre (150 000 FCFA). Merci de bien vouloir régulariser. Cordialement, Agence X."
- À chaque relance, `last_reminder_at` et `reminder_count` sont mis à jour dans `rent_calls`.

### Phase 4 — Fin de bail et historique

1. Le gestionnaire peut clôturer un bail (`status = 'terminated'`) avec une date de fin.
2. Toutes les échéances et paiements liés restent accessibles en lecture.
3. Le lot repasse en `vacant` et peut être reloué.

### Phase 5 — Abonnement SaaS

Voir la section "Stratégie de souscription" ci-dessous.

---

## 🧱 STACK TECHNIQUE IMPOSÉE

| Brique               | Outil                                                                     | Rôle                                |
| -------------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| Frontend + API       | **Next.js 15 (App Router) + TypeScript**                                  | UI et routes API                    |
| UI                   | **Tailwind CSS + shadcn/ui**                                              | Composants cohérents et accessibles |
| Base de données      | **Supabase (Postgres)**                                                   | Données, RLS multi-tenant           |
| Auth                 | **Supabase Auth**                                                         | Email + mot de passe                |
| Stockage fichiers    | **Supabase Storage**                                                      | Logos, photos, PDF de baux          |
| Emails               | **Resend**                                                                | Quittances, relances, notifications |
| PDF                  | **@react-pdf/renderer**                                                   | Quittances et baux                  |
| WhatsApp             | **Lien `wa.me`**                                                          | Relances manuelles (Phase 1)        |
| Paiement SaaS        | **CinetPay**                                                              | Encaissement mobile money           |
| Cron                 | **Vercel Cron**                                                           | Génération des échéances            |
| Hébergement          | **Vercel**                                                                | Deploy                              |
| Dépendances frontend | **Zod** (validation), **React Hook Form**, **date-fns**, **lucide-react** |                                     |
| Dépendances backend  | **@supabase/ssr**, **@supabase/supabase-js**                              |                                     |

**Interdictions :**

- Pas de `service_role` côté client. Jamais.
- Pas d'appels API vers des services externes non listés ci-dessus sans demander.
- Pas de décimales sur les montants en FCFA (stockés en `numeric(12,2)` en base mais affichés entiers).

---

## 🗄️ MODÈLE DE DONNÉES (RAPPEL)

Les tables suivantes existent déjà et ne doivent pas être modifiées sans raison :
`organizations`, `profiles`, `memberships`, `owners`, `properties`, `units`, `tenants`, `leases`, `rent_calls`, `payments`, `subscription_payments`.

**Règles invariantes :**

- Toute table métier porte une colonne `organization_id`.
- RLS activée partout. Aucune exception.
- Les politiques RLS utilisent les fonctions `is_org_member()`, `is_org_owner()`, `can_write_org()`.
- Les triggers gèrent : `updated_at`, `rent_calls.total_amount`, `rent_calls.status` après chaque paiement, création de `profiles` à l'inscription.

---

## 💰 STRATÉGIE DE SOUSCRIPTION

### Modèle : abonnement mensuel par agence, paliers selon le nombre de lots actifs

Le prix est aligné sur la valeur réelle : un lot géré rapporte à l'agence entre 25 000 et 100 000 FCFA/mois de commission. L'abonnement doit représenter **moins de 10 % de ce revenu** pour être évident à accepter.

| Plan          | Prix / mois              | Lots inclus      | Cible                             | Fonctionnalités                                                                                                       |
| ------------- | ------------------------ | ---------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Starter**   | **9 900 FCFA**           | jusqu'à 25 lots  | Petit bailleur, agent indépendant | Tout le MVP (biens, baux, échéances, paiements, quittances PDF, relances WhatsApp), 1 utilisateur                     |
| **Pro**       | **24 900 FCFA**          | jusqu'à 100 lots | Agence établie                    | Starter + 5 utilisateurs, import CSV des paiements bancaires, régularisation annuelle des charges, exports comptables |
| **Business**  | **59 900 FCFA**          | jusqu'à 300 lots | Agence multi-sites                | Pro + 15 utilisateurs, multi-agences, API, support prioritaire, personnalisation des quittances                       |
| **Sur devis** | À partir de 150 000 FCFA | illimité         | Grande agence, promoteur          | Tout + SLA, onboarding sur site, formation                                                                            |

### Règles commerciales

1. **Essai gratuit de 30 jours**, sans carte, sur le plan Pro (pas Starter). L'utilisateur teste le maximum de valeur.
2. **Pas de commission sur les loyers.** Jamais. C'est un argument de vente majeur face aux concurrents.
3. **Facturation mensuelle en mobile money** via CinetPay (Wave, Orange Money, MTN, Moov).
4. **Le mobile money n'autorise pas le prélèvement automatique.** Il faut donc :
   - Envoyer un rappel J-3 avant l'échéance (email + WhatsApp avec lien de paiement).
   - Envoyer un rappel J+2 après échéance.
   - Envoyer un rappel J+7 avant suspension.
5. **Grâce de 7 jours** après échéance avant passage en lecture seule. Pas de suppression des données. Jamais.
6. **Remise annuelle : -20 %** si paiement de 12 mois d'avance (soit 10 mois payés).
7. **Parrainage : 1 mois offert** pour le parrain et le filleul après le premier paiement du filleul.

### Cycle de vie de l'abonnement

- `trialing` → 30 jours, accès complet au plan Pro
- `active` → paiement reçu, accès complet au plan souscrit
- `past_due` → paiement en retard, accès lecture seule après 7 jours
- `cancelled` → résilié, lecture seule + export possible

### Implémentation technique

- Les webhooks CinetPay arrivent sur `/api/webhooks/cinetpay`, vérifient la signature, puis mettent à jour `organizations.subscription_status` et `subscription_expires_at` via le `service_role` (jamais exposé côté client).
- Un cron quotidien à 8h vérifie les abonnements expirés et fait passer les organisations en `past_due` puis en lecture seule.
- Un middleware Next.js vérifie à chaque requête si l'organisation est en lecture seule, et bloque les écritures si nécessaire (à l'exception des routes de facturation).

---

## ✅ LIVRABLES ATTENDUS (DANS CET ORDRE)

1. **Auth UI — réalisée** : `/signup`, `/login`, `/forgot-password`, `/reset-password` ; Supabase Auth, confirmation email, callback et middleware de session. Voir l'état d'avancement ci-dessus.
2. **Onboarding — implémenté localement, migration en attente** : formulaire agence et API Zod/RPC ; appliquer la migration avant le test authentifié de bout en bout.
3. **Dashboard** : `/dashboard` avec 4 KPIs (attendu / encaissé / impayés / taux d'occupation) et liste des alertes.
4. **CRUD Propriétés** : `/properties` (liste + création + édition).
5. **CRUD Lots** : `/properties/[id]` (détail avec liste des lots).
6. **CRUD Locataires** : `/tenants`.
7. **CRUD Baux** : `/leases` avec création en 3 étapes (lot → locataire → conditions).
8. **Échéances** : `/rent-calls` avec filtres par mois, statut, lot, locataire.
9. **Enregistrement de paiement** : modale sur chaque échéance.
10. **Quittance PDF** : génération et envoi par email + bouton WhatsApp.
11. **Relance WhatsApp** : bouton sur chaque échéance en retard.
12. **Facturation SaaS** : `/billing` avec les 3 plans, intégration CinetPay, gestion de l'essai gratuit.
13. **Paramètres** : `/settings` (agence, membres, profil).

---

## 🎨 PRINCIPES UX NON NÉGOCIABLES

- **Mobile-first.** 80 % des utilisateurs sont sur smartphone. Les tableaux larges doivent devenir des cartes empilées sur mobile.
- **Français**, ton professionnel mais direct. Pas de "Veuillez bien vouloir".
- **FCFA sans décimales**, avec espace comme séparateur de milliers : `150 000 FCFA`.
- **Dates au format `JJ/MM/AAAA`**.
- **Toujours 2 clics maximum** entre le dashboard et l'action la plus fréquente : relancer un impayé.
- **Feedback immédiat** sur chaque action (toast succès/erreur).
- **Pas de graphiques décoratifs** dans le MVP. Des chiffres, des listes, des boutons.

---

## 🚫 CE QU'IL NE FAUT PAS FAIRE

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client.
- Ne jamais désactiver RLS "pour tester plus vite".
- Ne jamais utiliser de composants lourds (Material UI, Ant Design) : on reste sur Tailwind + shadcn/ui.
- Ne jamais faire de calculs métier critiques (loyer, prorata, révision) sans test unitaire écrit AVANT.
- Ne jamais toucher à l'argent des loyers. La plateforme trace, elle n'encaisse pas.
- Ne jamais déployer une migration DB sans la versionner dans `supabase/migrations/`.

---

## 🎯 CRITÈRES DE SUCCÈS DU MVP

1. Une agence peut s'inscrire, créer son patrimoine, générer ses échéances et produire une quittance PDF **en moins de 30 minutes**, sans formation.
2. L'isolation RLS est **prouvée** par un test avec 2 organisations distinctes.
3. Le cron de génération mensuelle tourne sans erreur sur 3 mois consécutifs.
4. Le taux d'activation (inscription → premier paiement enregistré) dépasse **40 %** sur les 20 premiers testeurs.
5. Le premier client payant signe **dans les 60 jours** suivant la mise en ligne.

---

## 🗓️ MÉTHODE DE TRAVAIL ATTENDUE

- Avant chaque fonctionnalité : me demander **le contrat d'interface** (props, routes, payloads, réponses) et attendre ma validation.
- Après chaque fonctionnalité : lister les **tests manuels** que je dois exécuter pour la valider.
- Signaler **toute ambiguïté métier** avant de coder. Ne jamais inventer une règle de gestion.
- Utiliser **Zod** pour valider tous les payloads entrants.
- Écrire du code **lisible avant d'être astucieux**. Ce projet sera maintenu par une seule personne.

---

**État actuel : l'Auth UI est réalisée. Avant de coder l'Onboarding, proposer et faire valider son contrat d'interface (champs, payload, réponse, erreurs et redirection).**

---

Tu peux coller ce prompt directement dans ton outil de vibe coding. Il contient tout : le "pourquoi", le "quoi", le "comment", et le cadre commercial. Tu n'auras plus à répéter le contexte à chaque session.

Tu veux que je te prépare aussi une **version courte** de ce prompt (1 page) pour les sessions où tu ouvres un nouveau chat et veux juste rappeler l'essentiel ?

Avec zéro budget, viser le B2C ou le particulier est un piège : le coût d'acquisition est trop élevé et la valeur par client trop faible. La seule voie viable est de cibler le **B2B (agences et gestionnaires de biens)**, où la valeur contractuelle est forte et où tu peux démarcher en personne à Abidjan. C'est une stratégie B2B2C qui a fait ses preuves, et le moment est idéal pour se positionner.

---

### 📈 Opportunité de marché en Côte d'Ivoire

Le marché immobilier ivoirien est structurellement tendu, ce qui crée un besoin criant d'outils de gestion professionnels :

- **Déséquilibre offre/demande** : La demande en logements dépasse largement l'offre, ce qui provoque une hausse continue des loyers à Abidjan. Les professionnels croulent sous la gestion et cherchent à s'organiser.
- **Tickets de loyers élevés** : Les loyers moyens à Abidjan sont nettement plus élevés qu'à Bouaké ou Korhogo (de **400 000 à 800 000 FCFA/m²** contre 120 000 à 250 000 FCFA/m²), ce qui signifie que la valeur d'une gestion efficace est énorme pour une agence.
- **Secteur en pleine structuration** : Des acteurs comme la CNPC-CI appellent à développer une offre locative formelle. Il y a donc une volonté de professionnalisation qui profite aux outils de gestion.

### 🎯 Positionnement : Un MVP B2B ultra-ciblé

**Oublie le grand public.** Ton utilisateur, c'est **l'agent immobilier ou le gestionnaire de biens à Abidjan** qui gère 10 à 50 lots avec un fichier Excel et des rappels WhatsApp.

**Ton MVP (Version 1) doit résoudre un seul problème critique** : le suivi des loyers impayés et l'automatisation des relances. C'est le point de douleur numéro un. L'automatisation de la génération des quittances de loyer est un second levier majeur, car la loi ivoirienne rend cette obligation légale pour le bailleur. Une version web (responsive) est suffisante, pas besoin d'une app mobile native qui coûte cher.
