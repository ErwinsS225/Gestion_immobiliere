# 🎯 Objectifs de l'application pour une agence de gestion immobilière

Avant de parler d'objectifs, il faut cartographier ce que fait **réellement** une agence de gestion immobilière au quotidien. Une agence, ce n'est pas un seul métier : c'est **cinq activités distinctes** qui tournent en parallèle et qui se nourrissent mutuellement.

---

## 📊 Les 5 activités réelles d'une agence

| #   | Activité                       | Ce que ça implique concrètement                                                     | Temps réel passé |
| --- | ------------------------------ | ----------------------------------------------------------------------------------- | ---------------- |
| 1   | **Gestion locative**           | Trouver un locataire, signer le bail, encaisser les loyers, produire les quittances | 40 %             |
| 2   | **Gestion technique**          | Réparations, entretien, états des lieux, sinistres                                  | 15 %             |
| 3   | **Relation propriétaires**     | Rapports mensuels, reversements, justificatifs, transparence                        | 20 %             |
| 4   | **Relation locataires**        | Appels, relances, réclamations, médiation                                           | 15 %             |
| 5   | **Administratif & commercial** | Prospection de nouveaux mandats, comptabilité, conformité                           | 10 %             |

**Le constat terrain en Côte d'Ivoire :** la majorité des agences gèrent ces 5 activités avec Excel, WhatsApp, des cahiers physiques et beaucoup de mémoire. Résultat : les loyers en retard ne sont pas systématiquement relancés, les propriétaires se plaignent du manque de visibilité, les quittances sont produites en retard, et l'agence ne sait pas combien elle a réellement gagné dans le mois.

---

## 🎯 Les 7 objectifs de l'application

Ces objectifs sont classés par **ordre de priorité stratégique**. Les 3 premiers sont non négociables. Les 4 suivants viennent en phase 2.

### 🥇 Objectif 1 — Ne plus jamais perdre un loyer de vue

**Problème :** les impayés ne sont détectés que quand le propriétaire appelle pour se plaindre. Les relances sont faites à l'oral, sans trace, sans régularité.

**Objectif :** automatiser la détection des impayés et la relance.

**Traduction concrète :**

- Génération automatique des échéances le 1er du mois pour tous les baux actifs.
- Statut visible en temps réel : payé, partiel, en retard, impayé.
- Alerte dès J+1 de retard avec le nom du locataire, le montant, le nombre de jours.
- Bouton de relance WhatsApp pré-rédigé en 1 clic.

**Indicateur de succès :** réduction du délai moyen de relance de 15 jours à **moins de 48 heures**.

---

### 🥈 Objectif 2 — Diviser par 10 le temps de production administrative

**Problème :** une quittance prend 10 minutes à rédiger manuellement. Un état des lieux, 45 minutes. Un rapport mensuel propriétaire, 2 heures par bien.

**Objectif :** générer en 1 clic tout document standard.

**Traduction concrète :**

- Quittance PDF automatique dès qu'un paiement est enregistré.
- Envoi automatique par email + lien WhatsApp manuel.
- Modèles pré-remplis de bail, état des lieux, mise en demeure.
- Rapport mensuel propriétaire généré automatiquement le 5 de chaque mois.

**Indicateur de succès :** temps administratif par lot réduit de **45 minutes/mois à moins de 5 minutes/mois**.

---

### 🥉 Objectif 3 — Donner aux propriétaires une visibilité totale

**Problème :** le propriétaire appelle l'agence tous les 3 jours pour savoir si le loyer est arrivé. L'agence perd un temps fou en explications téléphoniques. La confiance s'effrite.

**Objectif :** rendre la transparence automatique.

**Traduction concrète :**

- Chaque propriétaire reçoit automatiquement (par email ou WhatsApp) :
  - Le relevé des loyers encaissés du mois.
  - Le décompte des impayés avec actions menées.
  - Le calcul exact de la commission de gestion.
  - Le montant net à reverser.
- Historique complet consultable à tout moment.

**Indicateur de succès :** réduction des appels entrants propriétaires de **60 %**.

---

### 4️⃣ Objectif 4 — Piloter l'activité par les chiffres, pas par l'intuition

**Problème :** le gérant ne sait pas, à un instant T, combien il a encaissé, combien il doit reverser, combien il a gagné. Les décisions se prennent à l'aveugle.

**Objectif :** fournir un tableau de bord décisionnel en temps réel.

**Traduction concrète :**

- **4 KPIs permanents** : loyers attendus, encaissés, impayés, taux d'occupation.
- Trésorerie prévisionnelle à 30 jours (loyers à venir − charges à venir).
- Classement des biens par rentabilité nette pour l'agence.
- Détection des lots chroniquement en retard (locataires à risque).

**Indicateur de succès :** le gérant connaît sa position exacte **en moins de 30 secondes**.

---

### 5️⃣ Objectif 5 — Centraliser la communication

**Problème :** les échanges sont éparpillés sur WhatsApp personnel, appels, SMS, emails. Aucune traçabilité. En cas de litige, l'agence n'a aucune preuve.

**Objectif :** historiser toutes les interactions dans une fiche unique par locataire et par propriétaire.

**Traduction concrète :**

- Chaque relance WhatsApp est datée et archivée.
- Notes internes sur chaque locataire (accord de paiement, promesse, incident).
- Pièces jointes liées au dossier (CNI, contrat, état des lieux, échanges).
- En cas de contentieux, export complet du dossier en PDF.

**Indicateur de succès :** 100 % des interactions traçables et exportables.

---

### 6️⃣ Objectif 6 — Sécuriser la conformité légale

**Problème :** la quittance de loyer est une **obligation légale** du bailleur en Côte d'Ivoire. Les agences qui ne la fournissent pas s'exposent à des litiges. De même, la loi encadre la révision annuelle du loyer, le dépôt de garantie, les délais de restitution.

**Objectif :** produire des documents conformes sans effort.

**Traduction concrète :**

- Quittances conformes aux mentions obligatoires.
- Modèles de bail à jour selon la réglementation ivoirienne (loi n° 2018-575 du 27 juin 2018 sur le bail d'habitation).
- Alertes automatiques sur les dates clés : révision annuelle du loyer, renouvellement du bail, restitution du dépôt.
- Journal des actions horodaté en cas de contentieux.

**Indicateur de succès :** zéro litige lié à un défaut de documentation.

---

### 7️⃣ Objectif 7 — Permettre à l'agence de croître sans recruter proportionnellement

**Problème :** une agence qui gère 20 lots mobilise 1 gestionnaire à temps plein. À 60 lots, il faut 3 personnes. La croissance est freinée par les coûts salariaux.

**Objectif :** faire de l'application un levier de scalabilité.

**Traduction concrète :**

- Un gestionnaire peut gérer **3× plus de lots** avec le même temps de travail.
- Le gérant peut suivre l'activité de ses gestionnaires depuis son téléphone.
- Système de rôles (owner / manager / viewer) pour déléguer sans risque.
- Import CSV pour intégration comptable, sans re-saisie.

**Indicateur de succès :** ratio lots gérés / gestionnaire passe de **25 à 75** en 12 mois.

---

## 🔗 Correspondance Objectifs ↔ Activités ↔ Fonctionnalités

| Activité de l'agence       | Objectif prioritaire                   | Fonctionnalité clé                 |
| -------------------------- | -------------------------------------- | ---------------------------------- |
| Gestion locative           | Objectif 1 — Zéro loyer perdu          | Échéances auto + relances WhatsApp |
| Gestion technique          | Objectif 2 — Zéro paperasse            | Modèles PDF + rappels d'entretien  |
| Relation propriétaires     | Objectif 3 — Transparence totale       | Rapport mensuel automatique        |
| Relation locataires        | Objectif 5 — Communication tracée      | Historique par fiche locataire     |
| Administratif & commercial | Objectif 4 — Pilotage par les chiffres | Dashboard temps réel               |
| Conformité                 | Objectif 6 — Sécurité légale           | Documents conformes + alertes      |
| Croissance                 | Objectif 7 — Scalabilité               | Rôles + import + multi-sites       |

---

## 💡 Le positionnement en une phrase

> **Locagest CI est l'outil qui permet à une agence de gestion immobilière ivoirienne de gérer 3 fois plus de lots avec la même équipe, tout en produisant automatiquement les documents légaux et en donnant aux propriétaires une visibilité qu'ils n'ont jamais eue.**

---

## 🎯 Ce que l'application ne doit PAS chercher à faire

Il est aussi important de délimiter le périmètre que de le définir :

- **Ne pas encaisser les loyers.** L'argent circule hors plateforme. L'application trace, elle ne manipule pas.
- **Ne pas devenir un portail grand public.** Les utilisateurs sont les agences, pas les locataires.
- **Ne pas gérer la copropriété (syndic).** C'est un métier différent, avec une réglementation différente.
- **Ne pas se substituer au comptable.** Elle exporte, elle ne tient pas la comptabilité générale.
- **Ne pas chercher à tout faire en V1.** Les 3 premiers objectifs sont le cœur. Les 4 autres viendront après validation terrain.

---

## 📈 Proposition de roadmap alignée sur ces objectifs

| Phase                | Durée      | Objectifs couverts | Livrable                                                                               |
| -------------------- | ---------- | ------------------ | -------------------------------------------------------------------------------------- |
| **V1 — MVP**         | 6 semaines | Objectifs 1, 2, 6  | Inscription, patrimoine, baux, échéances, paiements, quittances PDF, relances WhatsApp |
| **V2 — Pilotage**    | 4 semaines | Objectifs 3, 4     | Dashboard KPIs, rapport propriétaire automatique, exports                              |
| **V3 — Scalabilité** | 4 semaines | Objectifs 5, 7     | Historique communication, multi-utilisateurs avancé, import CSV, API                   |
| **V4 — Premium**     | continu    | Tous               | Multi-sites, personnalisation, intégrations bancaires                                  |

---

## ✅ En résumé

Une agence de gestion immobilière qui digitalise son activité cherche **trois choses** :

1. **Sécuriser ses revenus** → ne plus perdre un loyer (Objectif 1)
2. **Réduire sa charge administrative** → produire les documents sans effort (Objectifs 2 et 6)
3. **Prouver sa valeur à ses clients** → transparence et pilotage (Objectifs 3 et 4)

Les objectifs 5 et 7 sont des **multiplicateurs** : ils ne créent pas la valeur initiale, ils permettent de la capitaliser et de grandir.

**Le succès de ton SaaS se mesure à une seule chose :** une agence qui l'utilise pendant 3 mois doit refuser catégoriquement de revenir en arrière. Si tu obtiens ça, tu as gagné.

Tu veux que je transforme ces objectifs en **OKR chiffrés sur 12 mois** (avec cibles précises par trimestre) pour piloter ton propre développement produit ?
