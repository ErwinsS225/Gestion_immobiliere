import { z } from "zod";
import {
  DEFAULT_PRORATA_BASIS,
  DEFAULT_PRORATA_MODE,
  MAX_DEPOSIT_MONTHS,
  PRORATA_BASES,
  PRORATA_MODES,
  computeMoveInBreakdown,
  isProrataBasis,
  isProrataMode,
  type ProrataBasis,
  type ProrataMode,
} from "@/lib/lease-utils";

const MODES: ProrataMode[] = PRORATA_MODES.map((mode) => mode.value);
const BASES: ProrataBasis[] = PRORATA_BASES.map((basis) => basis.value);

const uuid = z.string().uuid("Sélectionnez un élément valide.");
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Saisissez une date au format AAAA-MM-JJ.");

/** Montant en FCFA : entier, sans décimale, comme le veut la monnaie locale. */
const xofAmount = (label: string) =>
  z.preprocess(
    (input) => {
      if (input == null || (typeof input === "string" && input.trim() === "")) return 0;
      if (typeof input === "string" || typeof input === "number") return Number(input);
      return input;
    },
    z
      .number({ error: `${label} doit être un montant valide en FCFA.` })
      .finite(`${label} doit être un montant valide en FCFA.`)
      .int(`${label} doit être un montant entier en FCFA.`)
      .min(0, `${label} doit être positif ou nul.`)
      .max(9_999_999_999, `${label} est trop élevé.`),
  );

/** Taux de révision en pourcentage. */
const percentageSchema = z.preprocess(
  (input) => {
    if (input == null || (typeof input === "string" && input.trim() === "")) return 0;
    if (typeof input === "string" || typeof input === "number") return Number(input);
    return input;
  },
  z
    .number({ error: "Le taux de révision doit être un nombre." })
    .finite("Le taux de révision doit être un nombre.")
    .min(0, "Le taux de révision doit être positif ou nul.")
    .max(20, "Le taux de révision ne peut pas dépasser 20 %."),
);

/**
 * Contrat de création d'un bail.
 *
 * Le dépôt de garantie est plafonné à deux mois de loyer par l'article 416 de
 * la loi n° 2019-576 du 26 juin 2019 instituant le Code de la Construction et
 * de l'Habitat. Le refus est pose ici pour donner un message clair, et repris
 * en base par la contrainte leases_deposit_within_legal_cap, qui reste la
 * reference opposable.
 */
export const leaseFormSchema = z
  .object({
    unitId: uuid,
    tenantId: uuid,

    startDate: isoDate,
    endDate: z
      .union([isoDate, z.literal("")])
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),

    rentAmount: z.preprocess(
      (input) => {
        if (input == null || (typeof input === "string" && input.trim() === "")) return 0;
        if (typeof input === "string" || typeof input === "number") return Number(input);
        return input;
      },
      z
        .number({ error: "Le loyer doit être un montant valide en FCFA." })
        .finite("Le loyer doit être un montant valide en FCFA.")
        .int("Le loyer doit être un montant entier en FCFA.")
        .min(1, "Le loyer doit être supérieur à 0.")
        .max(9_999_999_999, "Le loyer est trop élevé."),
    ),
    chargesAmount: xofAmount("Les charges"),
    depositAmount: xofAmount("Le dépôt de garantie"),

    paymentDay: z.preprocess(
      (input) => {
        if (input == null || (typeof input === "string" && input.trim() === "")) return 1;
        if (typeof input === "string" || typeof input === "number") return Number(input);
        return input;
      },
      z
        .number({ error: "Le jour de paiement doit être un nombre." })
        .int("Le jour de paiement doit être un nombre entier.")
        .min(1, "Le jour de paiement doit être entre le 1 et le 28.")
        .max(28, "Le jour de paiement doit être entre le 1 et le 28."),
    ),

    prorataMode: z
      .enum(MODES as [ProrataMode, ...ProrataMode[]], { error: "Choisissez un mode de prorata." })
      .default(DEFAULT_PRORATA_MODE),
    prorataBasis: z
      .enum(BASES as [ProrataBasis, ...ProrataBasis[]], { error: "Choisissez une base de calcul." })
      .default(DEFAULT_PRORATA_BASIS),

    revisionRate: percentageSchema,
    notes: z
      .string()
      .trim()
      .max(2000, "Les notes ne peuvent pas dépasser 2000 caractères.")
      .optional()
      .nullable()
      .transform((value) => value || null),
  })
  .refine((value) => !value.endDate || value.endDate > value.startDate, {
    path: ["endDate"],
    message: "La date de fin doit être après la date de début.",
  })
  .refine(
    (value) => value.depositAmount <= value.rentAmount * MAX_DEPOSIT_MONTHS,
    {
      path: ["depositAmount"],
      message: "Le dépôt de garantie ne peut pas dépasser deux mois de loyer (article 416).",
    },
  );

export type LeaseFormValues = z.infer<typeof leaseFormSchema>;

/**
 * Récapitulatif affiché avant enregistrement.
 *
 * Le calcul est délégué à computeMoveInBreakdown, également utilisé par les
 * tests : le montant affiché est donc exactement celui qui sera enregistré.
 */
export function buildMoveInPreview(values: {
  rentAmount: number;
  chargesAmount: number;
  depositAmount: number;
  startDate: string;
  prorataMode?: string;
  prorataBasis?: string;
}) {
  const mode = isProrataMode(values.prorataMode) ? values.prorataMode : DEFAULT_PRORATA_MODE;
  const basis = isProrataBasis(values.prorataBasis) ? values.prorataBasis : DEFAULT_PRORATA_BASIS;

  return computeMoveInBreakdown(
    values.rentAmount,
    values.chargesAmount,
    values.depositAmount,
    values.startDate,
    mode,
    basis,
  );
}
