// Typologie de l etat des lieux et de l inventaire.
//
// Deux notions distinctes, souvent confondues :
//   - l inventaire liste les objets MOBILES d un logement (frigo, TV, lave-linge) ;
//   - l etat des lieux verifie le BATI piece par piece (murs, sol, prises).
//
// Les listes ci-dessous sont la source de verite cote client. La base n impose
// que le format, pas le referentiel : une agence peut ajouter ses propres objets
// et ses propres pieces.

export const ITEM_CONDITIONS = [
  { value: "new", label: "Neuf", tone: "success" },
  { value: "good", label: "Bon état", tone: "success" },
  { value: "fair", label: "État d’usage", tone: "warning" },
  { value: "worn", label: "Usé", tone: "warning" },
  { value: "damaged", label: "Endommagé", tone: "danger" },
  { value: "missing", label: "Manquant", tone: "neutral" },
  { value: "replaced", label: "Remplacé", tone: "info" },
] as const;

export type ItemCondition = (typeof ITEM_CONDITIONS)[number]["value"];
export type ConditionTone = (typeof ITEM_CONDITIONS)[number]["tone"];

export const ITEM_CONDITION_VALUES: ItemCondition[] = ITEM_CONDITIONS.map(
  (condition) => condition.value,
);

export function getConditionMeta(condition: string) {
  return (
    ITEM_CONDITIONS.find((entry) => entry.value === condition) ??
    // Bon etat est la valeur par defaut de la base : on l affiche plutot que
    // de laisser un-chip vide si la valeur est inconnue.
    ITEM_CONDITIONS[1]
  );
}

/** Une note explicative est obligatoire des qu un element est endommage. */
export function requiresNote(condition: string): boolean {
  return condition === "damaged";
}

export const INSPECTION_TYPES = [
  { value: "move_in", label: "État des lieux d’entrée" },
  { value: "move_out", label: "État des lieux de sortie" },
  { value: "periodic", label: "Contrôle périodique" },
  { value: "pre_rental", label: "Avant mise en location" },
] as const;

export type InspectionType = (typeof INSPECTION_TYPES)[number]["value"];

export function getInspectionTypeLabel(type: string): string {
  return INSPECTION_TYPES.find((entry) => entry.value === type)?.label ?? "État des lieux";
}

/**
 * Grille standard du bati : 8 pieces, 55 elements.
 *
 * Le gestionnaire n a plus qu a valider ou corriger : le formulaire pre-remplit
 * ces lignes, toutes a l etat Bon etat.
 */
export const DEFAULT_ROOMS: { name: string; elements: string[] }[] = [
  {
    name: "Entrée",
    elements: ["Sol", "Murs", "Plafond", "Porte principale", "Interrupteurs", "Serrure"],
  },
  {
    name: "Salon / Séjour",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Portes",
      "Fenêtres",
      "Prises électriques",
      "Interrupteurs",
      "Luminaires",
    ],
  },
  {
    name: "Cuisine",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Portes",
      "Fenêtres",
      "Évier",
      "Robinetterie",
      "Prises électriques",
      "Placards",
    ],
  },
  {
    name: "Chambre 1",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Fenêtre",
      "Prises électriques",
      "Interrupteurs",
    ],
  },
  {
    name: "Chambre 2",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Fenêtre",
      "Prises électriques",
      "Interrupteurs",
    ],
  },
  {
    name: "Salle de bain",
    elements: [
      "Sol",
      "Murs",
      "Plafond",
      "Porte",
      "Douche / Baignoire",
      "Lavabo",
      "WC",
      "Robinetterie",
      "Ventilation",
    ],
  },
  {
    name: "WC",
    elements: ["Sol", "Murs", "Plafond", "Porte", "WC", "Lavabo", "Ventilation"],
  },
  {
    name: "Balcon / Terrasse",
    elements: ["Sol", "Murs", "Plafond", "Garde-corps", "Porte-fenêtre"],
  },
];

/** Nombre total de points de controle de la grille standard. */
export const DEFAULT_INSPECTION_ITEM_COUNT = DEFAULT_ROOMS.reduce(
  (total, room) => total + room.elements.length,
  0,
);

/** Ordre d'affichage du catalogue d'objets, aligne sur la grille des pieces. */
export const INVENTORY_ROOM_ORDER = [
  "Salon",
  "Chambre",
  "Cuisine",
  "Salle de bain",
  "Buanderie",
  "Divers",
  "Extérieur",
];
