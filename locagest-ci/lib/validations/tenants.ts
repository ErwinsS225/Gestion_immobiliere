import { z } from "zod";

/** Un numéro ivoirien ou international, saisi librement. */
const phoneRegex = /^[+()\d\s.-]*$/;
const phone = (label: string) =>
  z
    .string()
    .trim()
    .min(6, `${label} doit contenir au moins 6 caractères.`)
    .max(30, `${label} ne peut pas dépasser 30 caractères.`)
    .regex(phoneRegex, "Utilisez un numéro de téléphone valide.");

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
  .max(30, "Le numéro ne peut pas dépasser 30 caractères.")
  .regex(phoneRegex, "Utilisez un numéro de téléphone valide.")
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

/**
 * Contrat de création d'un locataire.
 *
 * Le téléphone est obligatoire : c'est par lui que l'agence relance, et WhatsApp
 * est le canal de contact dominant. Le numéro WhatsApp est facultatif, mais
 * lorsqu'il est présent il doit être valide, sinon le lien de relance serait
 * construit sur une adresse fausse.
 */
export const tenantSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Le nom du locataire doit contenir au moins 2 caractères.")
      .max(120, "Le nom du locataire ne peut pas dépasser 120 caractères."),
    phone: phone("Le téléphone"),
    whatsapp: optionalPhone,
    email: optionalEmail,
    idDocument: optionalText(100, "La référence du document"),
    notes: optionalText(1000, "Les notes"),
  })
  .refine((value) => !value.whatsapp || value.whatsapp !== value.phone, {
    path: ["whatsapp"],
    message: "Le numéro WhatsApp doit être différent du téléphone principal.",
  });

export type TenantValues = z.infer<typeof tenantSchema>;

/** Ligne de locataire renvoyée par l'API, avec son bail éventuel. */
export interface TenantRecord {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  id_document: string | null;
  notes: string | null;
  created_at: string;
}
