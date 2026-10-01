// Typologie des biens gérés par une agence immobilière ivoirienne.
//
// La catégorie découle toujours du type : l'utilisateur choisit un type, la
// catégorie s'en déduit. Cette liste est la source de vérité côté client ; le
// catalogue est rejoué en base par la contrainte
// public.unit_type_matches_category, donc un écart ici se verrait à l'écriture.

export const PROPERTY_CATEGORIES = [
  {
    label: "Résidentiel",
    value: "residential",
    types: [
      { label: "Studio", value: "studio" },
      { label: "Studio américain", value: "studio_american" },
      { label: "Appartement F1 / T1", value: "apartment_f1" },
      { label: "Appartement F2 / T2", value: "apartment_f2" },
      { label: "Appartement F3 / T3", value: "apartment_f3" },
      { label: "Appartement F4 / T4", value: "apartment_f4" },
      { label: "Appartement F5 / T5", value: "apartment_f5" },
      { label: "Appartement F6+ / T6+", value: "apartment_f6_plus" },
      { label: "Duplex", value: "duplex" },
      { label: "Triplex", value: "triplex" },
      { label: "Penthouse", value: "penthouse" },
      { label: "Villa basse", value: "villa_low" },
      { label: "Villa duplex", value: "villa_duplex" },
      { label: "Villa triplex", value: "villa_triplex" },
      { label: "Villa jumelée", value: "villa_twin" },
      { label: "Villa en bande", value: "villa_row" },
      { label: "Maison individuelle", value: "house" },
      { label: "Maison en cour commune", value: "house_compound" },
      { label: "Immeuble résidentiel entier", value: "building_residential" },
    ],
  },
  {
    label: "Commercial",
    value: "commercial",
    types: [
      { label: "Boutique", value: "shop" },
      { label: "Local commercial", value: "commercial_unit" },
      { label: "Magasin", value: "store" },
      { label: "Showroom", value: "showroom" },
      { label: "Kiosque / Échoppe", value: "kiosk" },
      { label: "Étal de marché", value: "market_stall" },
    ],
  },
  {
    label: "Professionnel / Bureaux",
    value: "professional",
    types: [
      { label: "Bureau individuel", value: "office_single" },
      { label: "Plateau de bureaux", value: "office_floor" },
      { label: "Immeuble de bureaux entier", value: "building_office" },
      { label: "Cabinet", value: "cabinet" },
      { label: "Espace coworking", value: "coworking" },
      { label: "Salle de réunion / formation", value: "meeting_room" },
    ],
  },
  {
    label: "Industriel & Logistique",
    value: "industrial",
    types: [
      { label: "Entrepôt", value: "warehouse" },
      { label: "Hangar", value: "hangar" },
      { label: "Atelier", value: "workshop" },
      { label: "Usine", value: "factory" },
      { label: "Dépôt", value: "depot" },
      { label: "Terrain industriel", value: "land_industrial" },
    ],
  },
  {
    label: "Touristique & Court séjour",
    value: "tourism",
    types: [
      { label: "Appartement meublé", value: "apartment_furnished" },
      { label: "Villa meublée", value: "villa_furnished" },
      { label: "Résidence meublée", value: "residence_furnished" },
      { label: "Chambre d'hôtel", value: "hotel_room" },
      { label: "Maison d'hôtes", value: "guesthouse" },
      { label: "Résidence hôtelière", value: "residence_hotel" },
    ],
  },
  {
    label: "Mixte",
    value: "mixed",
    types: [{ label: "Immeuble à usage mixte", value: "mixed_use" }],
  },
  {
    label: "Terrain & Annexes",
    value: "land_annex",
    types: [
      { label: "Terrain nu", value: "land" },
      { label: "Terrain viabilisé", value: "land_serviced" },
      { label: "Terrain agricole", value: "land_agricultural" },
      { label: "Parking / Place", value: "parking" },
      { label: "Garage / Box fermé", value: "garage" },
      { label: "Cave / Débarras", value: "storage_room" },
    ],
  },
] as const;

export type PropertyCategory = (typeof PROPERTY_CATEGORIES)[number]["value"];
export type UnitType = (typeof PROPERTY_CATEGORIES)[number]["types"][number]["value"];

export const DEFAULT_UNIT_TYPE: UnitType = "apartment_f2";

const TYPES_PAR_CATEGORIE = PROPERTY_CATEGORIES.map((category) => ({
  categorie: category.value as PropertyCategory,
  valeurs: category.types.map((type) => type.value),
}));

const CATEGORIE_PAR_TYPE: Record<string, PropertyCategory> = Object.fromEntries(
  TYPES_PAR_CATEGORIE.flatMap(({ categorie, valeurs }) =>
    valeurs.map((valeur) => [valeur, categorie]),
  ),
);

/** Liste à plat des types, dans l'ordre du formulaire. */
export const ALL_UNIT_TYPES: string[] = TYPES_PAR_CATEGORIE.flatMap(({ valeurs }) => valeurs);

/** Libellé lisible d'un type, pour les listes et les fiches. */
export function getTypeLabel(type: string): string {
  for (const categorie of PROPERTY_CATEGORIES) {
    const trouve = categorie.types.find((entry) => entry.value === type);
    if (trouve) return trouve.label;
  }
  return "Autre";
}

/** Catégorie déduite du type. Un type inconnu est traité comme résidentiel. */
export function getCategoryFromType(type: string): PropertyCategory {
  return CATEGORIE_PAR_TYPE[type] ?? "residential";
}

/** Vrai si la catégorie autorise ce type. Miroir de la contrainte en base. */
export function isTypeInCategory(type: string, category: string): boolean {
  return TYPES_PAR_CATEGORIE.some(
    (entry) => entry.categorie === category && entry.valeurs.includes(type as never),
  );
}

// ---------------------------------------------------------------------------
// Affichage conditionnel des champs
//
// Un studio n'affiche pas les mêmes champs qu'un entrepôt. Chaque groupe est
// donc conditionné par la catégorie déduite du type choisi.
// ---------------------------------------------------------------------------

export const isResidentialLike = (category: string) =>
  category === "residential" || category === "tourism" || category === "mixed";

export const isCommercialLike = (category: string) =>
  category === "commercial" || category === "professional" || category === "mixed";

export const isIndustrial = (category: string) => category === "industrial";

export const isTerrainOrAnnexe = (category: string) => category === "land_annex";

/** Un parking, un garage ou une cave n'ont ni surface habitable ni pièces. */
export const isAnnexeSeule = (type: string) =>
  ["parking", "garage", "storage_room"].includes(type);
