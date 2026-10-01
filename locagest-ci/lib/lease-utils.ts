// Calculs metier lies aux baux.
//
// Cadre juridique
// ----------------
// Le bail a usage d habitation est regi par la loi n 2019-576 du 26 juin 2019
// instituant le Code de la Construction et de l Habitat, livre 2, titre 1,
// sous-titre 2 (art. 408 a 456), sous reserve du Code civil.
//
// Regles imperatives appliquees ici :
//   art. 415 : le bailleur ne peut exiger plus de deux mois de loyers d avance ;
//   art. 416 : le depot de garantie ne peut exceder deux mois de loyer ;
//   art. 455 : une augmentation est reputee n etre jamais intervenue si elle a
//              lieu moins de trois annees apres la conclusion du bail.
//
// En revanche ce texte ne dit RIEN du prorata du premier mois lorsque le bail
// commence en cours de mois. Il n existe donc pas de regle legale ivoirienne a
// ce sujet : c est un usage contractuel, opposable seulement s il est ecrit au
// bail. D ou les deux reglages exposes ici, le decompte des jours et la base de
// calcul, que l agence fixe sur son contrat type.
//
// Le decret n 2024-1115 du 19 decembre 2024 encadre les frais d intermeduction :
// un mois de loyer hors taxes partage a parts egales entre bailleur et
// locataire. Son libelle exact n a pas pu etre verifie dans le Journal Officiel,
// la regle est donc rappelee a titre informatif et non controlee.

// Modes de decompte : comment compter les jours occupes dans le mois.
export const PRORATA_MODES = [
  {
    value: "days_remaining",
    label: "Jours restants (inclus)",
    description:
      "Facture du jour de début jusqu’à la fin du mois inclus. Bail le 15, mois de 31 jours : 17 jours.",
  },
  {
    value: "days_remaining_plus_one",
    label: "Jours restants + jour d’entrée",
    description:
      "Comme ci-dessus, mais le jour de début est compté une seconde fois. Bail le 15 : 18 jours.",
  },
  {
    value: "full_month",
    label: "Mois plein",
    description:
      "Facture le mois complet, même si le bail commence en cours de mois.",
  },
] as const;

export type ProrataMode = (typeof PRORATA_MODES)[number]["value"];

export const DEFAULT_PRORATA_MODE: ProrataMode = "days_remaining";

export function isProrataMode(value: unknown): value is ProrataMode {
  return PRORATA_MODES.some((mode) => mode.value === value);
}


// Base de calcul du prorata.
//
// Usage contractuel, la loi ne fixant aucune formule. Deux methodes coexistent :
//   calendar_month    : on divise par le nombre reel de jours du mois
//   thirty_day_month  : on divise par 30, methode des usages comptables
//
// La methode du mois de 30 jours majore le prorata d environ 3 % : pour un
// bail le 15, elle facture 175 000 x 17 / 30 au lieu de 175 000 x 17 / 31.
// Elle est licite, mais doit figurer au bail pour etre opposable.

export const PRORATA_BASES = [
  {
    value: "calendar_month",
    label: "Mois réel",
    description:
      "Divise par le nombre exact de jours du mois (28, 29, 30 ou 31). Reflète la réalité calendaire.",
  },
  {
    value: "thirty_day_month",
    label: "Mois de 30 jours",
    description:
      "Divise par 30 quel que soit le mois. Usage comptable courant ; majore le prorata d’environ 3 %.",
  },
] as const;

export type ProrataBasis = (typeof PRORATA_BASES)[number]["value"];

export const DEFAULT_PRORATA_BASIS: ProrataBasis = "calendar_month";

/** Nombre de jours retenu comme denominateur par la methode du mois de 30 jours. */
export const COMMERCIAL_MONTH_DAYS = 30;

/**
 * Nombre de jours occupes en dessous duquel le prorata n est pas retenu.
 *
 * Le risque n est pas symetrique. En mois reel, un bail demarrant le 31
 * represente legitimement 1/31 du mois : le prorata doit etre conserve, car il
 * reflete exactement l occupation. En mois de 30 jours, ce meme bail
 * representerait 1/30, et un bail demarrant le 25 representerait 6/30, soit
 * presque un quart du loyer pour sept jours : ce n est pas defendable.
 *
 * Le garde-fou ne s applique donc qu a la base du mois de 30 jours. En mois
 * reel il ne s applique jamais, sinon un bail legitime demarrant le 31 se
 * verrait facturer un mois plein au lieu d une journee.
 */
export const MIN_OCCUPIED_DAYS_FOR_PRORATA = 7;

export function isProrataBasis(value: unknown): value is ProrataBasis {
  return PRORATA_BASES.some((basis) => basis.value === value);
}


// Plafonds legaux issus des articles 415, 416 et 455 du Code de la Construction
// et de l Habitat.
export const MAX_DEPOSIT_MONTHS = 2;
export const MIN_REVISION_YEARS = 3;
/** Art. 415 : le bailleur ne peut exiger plus de deux mois de loyers d avance. */
export const MAX_RENT_ADVANCE_MONTHS = 2;

/**
 * Nombre de jours dans un mois donne.
 *
 * On passe par l UTC : `new Date(2026, 1, 0)` en heure locale peut renvoyer le
 * 28 ou le 29 selon le decalage, et un prorata faux d un jour change le montant
 * facture au locataire.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Convertit une date ISO (YYYY-MM-DD) en Date UTC a minuit. */
function parseIsoDate(value: string): Date {
  const [annee, mois, jour] = value.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, jour));
}

export interface ProrataResult {
  /** Montant du premier mois, apres application du prorata. */
  amount: number;
  /** Jours factures sur le mois. */
  occupiedDays: number;
  /** Denominateur retenu : jours reels du mois, ou 30. */
  totalDays: number;
  /** Vrai si le mois est facture en entier. */
  isFullMonth: boolean;
  mode: ProrataMode;
  basis: ProrataBasis;
  /**
   * Vrai si le garde-fou a force le mois plein. La methode du mois de 30 jours
   * produit un rapport trop eleve sur une courte occupation : dans ce cas on
   * facture le mois entier plutot que de exceeder ce seuil.
   */
  safetyApplied: boolean;
}

/**
 * Calcule le premier mois de loyer.
 *
 * @param monthlyAmount  Loyer + charges mensuels du bail
 * @param startDateIso    Date de debut au format YYYY-MM-DD
 * @param mode            Comment compter les jours occupes
 * @param basis           Par quel nombre diviser
 */
export function computeProrata(
  monthlyAmount: number,
  startDateIso: string,
  mode: ProrataMode = DEFAULT_PRORATA_MODE,
  basis: ProrataBasis = DEFAULT_PRORATA_BASIS,
): ProrataResult {
  const start = parseIsoDate(startDateIso);
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + 1;
  const startDay = start.getUTCDate();
  const calendarDays = daysInMonth(year, month);
  const totalDays = basis === "thirty_day_month" ? COMMERCIAL_MONTH_DAYS : calendarDays;

  const pleinMois = (safetyApplied: boolean): ProrataResult => ({
    amount: monthlyAmount,
    occupiedDays: calendarDays,
    totalDays: calendarDays,
    isFullMonth: true,
    mode,
    basis,
    safetyApplied,
  });

  // Un bail demarrant le 1er couvre le mois entier : aucun prorata n est calcule,
  // quel que soit le reglage, ce qui evite un arrondi sans objet.
  if (mode === "full_month" || startDay === 1) {
    return pleinMois(false);
  }

  const occupiedDays =
    mode === "days_remaining_plus_one" ? calendarDays - startDay + 2 : calendarDays - startDay + 1;

  // Garde-fou : concerne uniquement la base du mois de 30 jours. En mois reel,
  // meme un bail demarrant le 31 reflects fidelement l occupation et doit rester
  // facture au prorata. En base 30 jours, une occupation de quelques jours
  // representerait une part disproportionnee du loyer : on facture alors le mois
  // plein, ce qui est plus protecteur pour le locataire.
  if (basis === "thirty_day_month" && occupiedDays < MIN_OCCUPIED_DAYS_FOR_PRORATA) {
    return pleinMois(true);
  }

  return {
    amount: Math.round((monthlyAmount * occupiedDays) / totalDays),
    occupiedDays,
    totalDays,
    isFullMonth: false,
    mode,
    basis,
    safetyApplied: false,
  };
}


export interface MoveInBreakdown {
  prorata: ProrataResult;
  /** Part du loyer pour la periode facturee. */
  rentPart: number;
  /** Part des charges pour la periode facturee. */
  chargesPart: number;
  /** Loyer + charges du premier mois. */
  firstMonthTotal: number;
  deposit: number;
  /** Somme exigible a la signature du bail. */
  moveInTotal: number;
  /** Vrai si le depot respecte le plafond de l article 416. */
  depositIsLegal: boolean;
  /** Plafond legal du depot, en FCFA. */
  maxDeposit: number;
}

/**
 * Decompte du montant exigible a l entree : premier mois proratise et depot de
 * garantie.
 *
 * Le prorata est applique separement au loyer et aux charges, chacun arrondi au
 * franc, et la somme des parts est retenue : le recapitulatif affiche alors des
 * lignes dont la somme est exacte.
 *
 * Le depot est controle au regard de l article 416, qui le plafonne a deux mois
 * de loyer. Le loyer est la reference : les charges couvrent des frais variables
 * ou des services, pas la valeur du bien mis en location.
 */
export function computeMoveInBreakdown(
  monthlyRent: number,
  monthlyCharges: number,
  deposit: number,
  startDateIso: string,
  mode: ProrataMode = DEFAULT_PRORATA_MODE,
  basis: ProrataBasis = DEFAULT_PRORATA_BASIS,
): MoveInBreakdown {
  const prorata = computeProrata(monthlyRent + monthlyCharges, startDateIso, mode, basis);

  const rentPart = computeProrata(monthlyRent, startDateIso, mode, basis).amount;
  const chargesPart = computeProrata(monthlyCharges, startDateIso, mode, basis).amount;

  const firstMonthTotal = prorata.isFullMonth
    ? monthlyRent + monthlyCharges
    : rentPart + chargesPart;
  const maxDeposit = monthlyRent * MAX_DEPOSIT_MONTHS;

  return {
    prorata,
    rentPart: prorata.isFullMonth ? monthlyRent : rentPart,
    chargesPart: prorata.isFullMonth ? monthlyCharges : chargesPart,
    firstMonthTotal,
    deposit,
    moveInTotal: firstMonthTotal + deposit,
    depositIsLegal: deposit <= maxDeposit,
    maxDeposit,
  };
}

/** Formate un montant en FCFA, sans decimales. */
export function formatFCFA(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${Math.round(value).toLocaleString("fr-FR")} FCFA`;
}

export function formatDateFr(value: string): string {
  const date = parseIsoDate(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Libelle du jour de paiement choisi. */
export function paymentDayLabel(day: number): string {
  if (day === 1) return "Le 1er du mois (recommandé)";
  return `Le ${day} de chaque mois`;
}

/** Vrai si deux periodes se chevauchent. */
export function datesOverlap(
  startA: string,
  endA: string | null,
  startB: string,
  endB: string | null,
): boolean {
  const a = parseIsoDate(startA).getTime();
  const aEnd = endA ? parseIsoDate(endA).getTime() : Number.MAX_SAFE_INTEGER;
  const b = parseIsoDate(startB).getTime();
  const bEnd = endB ? parseIsoDate(endB).getTime() : Number.MAX_SAFE_INTEGER;
  return a <= bEnd && b <= aEnd;
}
