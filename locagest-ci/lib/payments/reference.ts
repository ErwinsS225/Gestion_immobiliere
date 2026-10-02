import { randomBytes } from "node:crypto";

/**
 * Préfixes de référence par moyen de paiement.
 *
 * Ils reprennent l'usage observed chez les opérateurs ivoiriens : un client qui
 * appelle l'agence avec « Wave 12345 » retrouve la trace immédiatement. La
 * référence reste interne : elle n'est jamais déduite de l'extérieur.
 */
const PREFIXES: Record<string, string> = {
  wave: "WVW",
  orange_money: "ORM",
  mtn: "MTN",
  moov: "MOV",
  cash: "ESP",
  bank_transfer: "VIR",
};

/**
 * Génère la référence d'un paiement, côté serveur.
 *
 * Format : PREFIXE-AAAAMMJJ-NNNNN
 * La date est celle du jour du paiement, pas celle de l'écriture en base : un
 * agent qui saisit un règlement de mars en avril doit obtenir une référence de
 * mars.
 */
export function generatePaymentReference(
  method: string,
  paidAt: Date = new Date(),
): string {
  const prefixe = PREFIXES[method] ?? "PAY";
  const annee = paidAt.getUTCFullYear();
  const mois = String(paidAt.getUTCMonth() + 1).padStart(2, "0");
  const jour = String(paidAt.getUTCDate()).padStart(2, "0");
  const alea = randomBytes(3).readUIntBE(0, 3) % 10000;

  return `${prefixe}-${annee}${mois}${jour}-${String(alea).padStart(4, "0")}`;
}

/**
 * Vérifie qu'une référence a bien la forme produite par le générateur.
 *
 * Le webhook d'un opérateur arrive avec une référence que l'application n'a pas
 * générée : elle est ignorée si elle ne respecte pas ce format, ce qui évite
 * d'écrire une ligne de paiement sur la foi d'une chaîne libre.
 */
export function isPaymentReference(value: string): boolean {
  return /^[A-Z]{3}-\d{8}-\d{4}$/.test(value);
}