import { z } from "zod";
import {
  ITEM_CONDITION_VALUES,
  type InspectionType,
} from "@/lib/inventory-types";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} ne peut pas dépasser ${max} caractères.`)
    .optional()
    .nullable()
    .transform((value) => value || null);

const conditionSchema = z.enum(ITEM_CONDITION_VALUES as [string, ...string[]], {
  error: "Choisissez un état valide.",
});

const quantitySchema = z.preprocess(
  (input) => {
    if (input == null || (typeof input === "string" && input.trim() === "")) return 1;
    if (typeof input === "string" || typeof input === "number") return Number(input);
    return input;
  },
  z
    .number({ error: "La quantité doit être un nombre." })
    .finite("La quantité doit être un nombre.")
    .int("La quantité doit être un nombre entier.")
    .min(1, "La quantité doit être au moins 1.")
    .max(999, "La quantité ne peut pas dépasser 999."),
);

/** Un objet du mobilier, dans l'inventaire d'un bail. */
export const inventoryItemSchema = z.object({
  catalogId: z.string().uuid("Objet du catalogue invalide.").optional().nullable(),
  name: z
    .string()
    .trim()
    .min(1, "Le nom de l'objet est obligatoire.")
    .max(120, "Le nom ne peut pas dépasser 120 caractères."),
  category: optionalText(60, "La pièce"),
  quantity: quantitySchema,
  condition: conditionSchema,
  notes: optionalText(500, "La note"),
  photoUrl: z
    .string()
    .trim()
    .max(500, "L’adresse de la photo est trop longue.")
    .optional()
    .nullable()
    .transform((value) => value || null),
  addedAfterMoveIn: z.boolean().optional().nullable(),
});

/**
 * Un objet endommage doit etre decrit : sans note, la comparaison a la sortie ne
 * peut rien etablir. La meme regle est posee en base par la contrainte
 * inventory_items_damaged_requires_note.
 */
export const inventoryItemRefined = inventoryItemSchema.refine(
  (value) => value.condition !== "damaged" || Boolean(value.notes),
  {
    path: ["notes"],
    message: "Décrivez le dommage constaté.",
  },
);

/** Un point de controle de l'état des lieux du bâti. */
export const inspectionItemSchema = z.object({
  room: z
    .string()
    .trim()
    .min(1, "Indiquez la pièce.")
    .max(80, "Le nom de la pièce ne peut pas dépasser 80 caractères."),
  element: z
    .string()
    .trim()
    .min(1, "Indiquez l’élément vérifié.")
    .max(80, "Le nom de l’élément ne peut pas dépasser 80 caractères."),
  condition: conditionSchema,
  notes: optionalText(500, "La note"),
  photoUrl: z
    .string()
    .trim()
    .max(500, "L’adresse de la photo est trop longue.")
    .optional()
    .nullable()
    .transform((value) => value || null),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .max(9_999)
    .optional(),
});

export const inspectionItemRefined = inspectionItemSchema.refine(
  (value) => value.condition !== "damaged" || Boolean(value.notes),
  {
    path: ["notes"],
    message: "Décrivez le dommage constaté.",
  },
);

/** Un rapport d'état des lieux et la liste de ses points de contrôle. */
export const inspectionReportSchema = z
  .object({
    type: z.enum(
      ["move_in", "move_out", "periodic", "pre_rental"] as [InspectionType, ...InspectionType[]],
      { error: "Choisissez un type d’état des lieux." },
    ),
    inspectionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide.")
      .optional(),
    tenantPresent: z.boolean().optional().nullable(),
    waterMeterIndex: z.preprocess(
      (input) =>
        input == null || (typeof input === "string" && input.trim() === "")
          ? null
          : Number(input),
      z
        .number({ error: "Le relevé doit être un nombre." })
        .finite("Le relevé doit être un nombre.")
        .min(0, "Le relevé ne peut pas être négatif.")
        .max(99_999_999.99, "Le relevé est trop élevé.")
        .nullable()
        .optional(),
    ),
    electricityMeterIndex: z.preprocess(
      (input) =>
        input == null || (typeof input === "string" && input.trim() === "")
          ? null
          : Number(input),
      z
        .number({ error: "Le relevé doit être un nombre." })
        .finite("Le relevé doit être un nombre.")
        .min(0, "Le relevé ne peut pas être négatif.")
        .max(99_999_999.99, "Le relevé est trop élevé.")
        .nullable()
        .optional(),
    ),
    generalNotes: optionalText(2_000, "Les observations générales"),
    items: z.array(inspectionItemRefined).max(200, "Le rapport dépasse 200 points de contrôle."),
  })
  .refine(
    (value) =>
      !value.inspectionDate ||
      /^\d{4}-\d{2}-\d{2}$/.test(value.inspectionDate),
    { path: ["inspectionDate"], message: "Date invalide." },
  );

export type InventoryItemValues = z.infer<typeof inventoryItemRefined>;
export type InspectionItemValues = z.infer<typeof inspectionItemRefined>;
export type InspectionReportValues = z.infer<typeof inspectionReportSchema>;
