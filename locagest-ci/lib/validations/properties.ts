import { z } from "zod";
import { ALL_UNIT_TYPES, getCategoryFromType } from "@/lib/property-types";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} ne peut pas dépasser ${max} caractères.`)
    .optional()
    .nullable()
    .transform((value) => value || null);

const optionalPhone = z
  .string()
  .trim()
  .max(30, "Le téléphone ne peut pas dépasser 30 caractères.")
  .regex(/^[+()\d\s.-]*$/, "Utilisez un numéro de téléphone valide.")
  .optional()
  .nullable()
  .transform((value) => value || null);

const optionalEmail = z
  .string()
  .trim()
  .max(120, "L’adresse e-mail ne peut pas dépasser 120 caractères.")
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Saisissez une adresse e-mail valide.",
  })
  .optional()
  .nullable()
  .transform((value) => value || null);

export const ownerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Le nom du propriétaire doit contenir au moins 2 caractères.")
    .max(120, "Le nom du propriétaire ne peut pas dépasser 120 caractères."),
  phone: optionalPhone,
  email: optionalEmail,
  idDocument: optionalText(100, "La référence du document"),
  notes: optionalText(1000, "Les notes"),
});

export const propertySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Le nom du bien doit contenir au moins 2 caractères.")
      .max(120, "Le nom du bien ne peut pas dépasser 120 caractères."),
    address: optionalText(200, "L’adresse"),
    commune: optionalText(80, "La commune"),
    ownerId: z.string().uuid("Sélectionnez un propriétaire valide.").optional().nullable(),
    newOwner: ownerSchema.optional().nullable(),
  })
  .refine((value) => !(value.ownerId && value.newOwner), {
    path: ["ownerId"],
    message: "Choisissez un propriétaire existant ou saisissez-en un nouveau.",
  });

const optionalNumber = (
  label: string,
  options: { integer?: boolean; positive?: boolean; max?: number; decimalPlaces?: number } = {},
) =>
  z.preprocess(
    (input) => {
      if (input == null || (typeof input === "string" && input.trim() === "")) return null;
      if (typeof input === "string" || typeof input === "number") return Number(input);
      return input;
    },
    z
      .number({ error: `${label} doit être un nombre valide.` })
      .finite(`${label} doit être un nombre valide.`)
      .min(options.positive ? 1 : 0, `${label} doit être ${options.positive ? "supérieur à 0" : "positif ou nul"}.`)
      .max(options.max ?? 9_999_999_999, `${label} est trop élevé.`)
      .refine((value) => !options.integer || Number.isInteger(value), {
        message: `${label} doit être un nombre entier.`,
      })
      .refine(
        (value) =>
          options.decimalPlaces == null ||
          Number(value.toFixed(options.decimalPlaces)) === value,
        { message: `${label} ne peut pas comporter plus de ${options.decimalPlaces} décimales.` },
      )
      .nullable()
      .optional(),
  );

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

/** Champs de surface, pièces et meublage : residential, tourisme, mixte. */
const residentialFields = {
  surfaceArea: optionalNumber("La surface", { max: 9_999_999_999.99, decimalPlaces: 2 }),
  roomCount: optionalNumber("Le nombre de pièces", { integer: true, positive: true, max: 32_767 }),
  bedroomCount: optionalNumber("Le nombre de chambres", { integer: true, max: 32_767 }),
  bathroomCount: optionalNumber("Le nombre de salles de bain", { integer: true, max: 32_767 }),
};

/** Champs propres au commercial et au professionnel. */
const commercialFields = {
  hasDisplayWindow: z.boolean().optional().nullable(),
  hasOpenSpace: z.boolean().optional().nullable(),
  workstationCount: optionalNumber("Le nombre de postes", { integer: true, max: 5_000 }),
};

/** Champs propres à l'industriel et la logistique. */
const industrialFields = {
  ceilingHeight: optionalNumber("La hauteur sous plafond", { max: 100, decimalPlaces: 2 }),
  hasLoadingDock: z.boolean().optional().nullable(),
};

/** Champs propres aux terrains. */
const landFields = {
  cadastralReference: optionalText(80, "La référence cadastrale"),
  isServiced: z.boolean().optional().nullable(),
};

export const unitSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, "Le libellé du lot est obligatoire.")
      .max(80, "Le libellé du lot ne peut pas dépasser 80 caractères."),
    unitType: z.enum(ALL_UNIT_TYPES as [string, ...string[]], {
      error: "Choisissez un type de bien.",
    }),
    buildingSection: optionalText(40, "La designation du batiment"),
    floor: optionalText(20, "L'etage"),
    ...residentialFields,
    ...commercialFields,
    ...industrialFields,
    ...landFields,
    isFurnished: z.boolean().optional().nullable(),
    depositAmount: xofAmount("Le depot de garantie"),
    baseRent: xofAmount("Le loyer de base"),
    charges: xofAmount("Les charges"),
    notes: optionalText(2000, "Les notes"),
  })
  // La categorie n est pas saisie : elle se deduit du type. Elle est tout de
  // meme verifiee ici pour renvoyer un message clair avant l aller-retour en
  // base, qui refuserait de la meme facon via units_type_matches_category.
  .transform((value) => ({
    ...value,
    category: getCategoryFromType(value.unitType),
  }))
  .refine((value) => value.baseRent > 0, {
    path: ["baseRent"],
    message: "Le loyer doit être supérieur à 0.",
  });

export type OwnerValues = z.infer<typeof ownerSchema>;
export type PropertyValues = z.infer<typeof propertySchema>;
export type UnitValues = z.infer<typeof unitSchema>;
