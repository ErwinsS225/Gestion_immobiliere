import { z } from "zod";

export const onboardingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom de l’agence doit contenir au moins 2 caractères.")
    .max(120, "Le nom de l’agence ne peut pas dépasser 120 caractères."),
  phone: z
    .string()
    .trim()
    .max(30, "Le numéro de téléphone ne peut pas dépasser 30 caractères.")
    .optional()
    .nullable(),
  city: z
    .string()
    .trim()
    .min(2, "Saisissez le nom d’une ville.")
    .max(80, "Le nom de la ville ne peut pas dépasser 80 caractères.")
    .default("Abidjan"),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;
