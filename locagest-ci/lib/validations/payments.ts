import { z } from "zod";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/payments/mode";
import { isPaymentReference } from "@/lib/payments/reference";

const METHODES: PaymentMethod[] = PAYMENT_METHODS.map((entry) => entry.value);

/**
 * Contrat d'enregistrement d'un paiement.
 *
 * La référence n'est jamais acceptée depuis le client : elle est générée par le
 * serveur, à partir du moyen et de la date. Un agent ne peut donc pas déclarer
 * une référence inventée, ni imputer un règlement sur un mauvais opérateur.
 *
 * Le champ de moyenne est réservé à la saisie d'un rejet : il est refusé sur un
 * paiement confirmé.
 */
export const paymentSchema = z
  .object({
    rentCallId: z.string().uuid("Sélectionnez une échéance."),
    amount: z.preprocess(
      (input) => {
        if (input == null || (typeof input === "string" && input.trim() === "")) return null;
        if (typeof input === "string" || typeof input === "number") return Number(input);
        return input;
      },
      z
        .number({ error: "Le montant doit être un nombre." })
        .finite("Le montant doit être un nombre.")
        .int("Le montant doit être un nombre entier en FCFA.")
        .min(1, "Le montant doit être supérieur à 0.")
        .max(9_999_999_999, "Le montant est trop élevé."),
    ),
    method: z.enum(METHODES as [PaymentMethod, ...PaymentMethod[]], {
      error: "Choisissez un moyen de paiement.",
    }),
    paidAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Saisissez une date au format AAAA-MM-JJ."),
    notes: z
      .string()
      .trim()
      .max(500, "La note ne peut pas dépasser 500 caractères.")
      .optional()
      .nullable()
      .transform((value) => value || null),
    /**
     * Motif d'un éventuel rejet d'opération.
     *
     * Le champ n'est pas transformé en chaîne vide : une saisie vide reste
     * visible et déclenche le message, au lieu de disparaître silencieusement.
     */
    rejectionReason: z
      .string()
      .trim()
      .max(200, "Le motif ne peut pas dépasser 200 caractères.")
      .optional()
      .nullable(),
  })
  .refine(
    (value) => value.rejectionReason == null || value.rejectionReason.length > 0,
    {
      path: ["rejectionReason"],
      message: "Indiquez le motif du rejet.",
    },
  );

export type PaymentValues = z.infer<typeof paymentSchema>;

/** Référence déjà enregistrée : sert au rejet d'une opération. */
export const paymentRejectionSchema = z.object({
  paymentReference: z
    .string()
    .trim()
    .refine(isPaymentReference, "Référence de paiement invalide."),
  rejectionReason: z
    .string()
    .trim()
    .min(3, "Indiquez le motif du rejet.")
    .max(200, "Le motif ne peut pas dépasser 200 caractères."),
});