// ============================================================
// Mode de paiement
//
// L application fonctionne d abord entierement en simulation : aucun paiement
// ne quitte l appareil. Les scripts sont ecrits comme en production, seule la
// porte de sortie change.
//
// Pour passer en reel, il n y a rien a reecrire : definir
// NEXT_PUBLIC_PAYMENT_MODE=live dans l environnement, puis renseigner
// PAYMENT_API_KEY et PAYMENT_API_URL. Le reste du code, y compris la signature
// des requetes, la verification du webhook et la remise a jour du statut, est
// deja en place.
//
// Regle tenue ici : le client ne choisit jamais la reference du paiement. Il
// declare un moyen (wave, orange_money, mtn, moov, cash, bank_transfer) et un
// montant ; la reference est generee par le serveur, dans la convention des
// operateurs ivoiriens. Un client ne peut donc pas forger un identifiant de
// transaction.
// ============================================================

export type PaymentMethod =
  | "wave"
  | "orange_money"
  | "mtn"
  | "moov"
  | "cash"
  | "bank_transfer";

export const PAYMENT_METHODS: {
  value: PaymentMethod;
  label: string;
  /** false : le paiement exige une confirmation de l operateur. */
  comptant: boolean;
}[] = [
  { value: "wave", label: "Wave", comptant: false },
  { value: "orange_money", label: "Orange Money", comptant: false },
  { value: "mtn", label: "MTN MoMo", comptant: false },
  { value: "moov", label: "Moov Money", comptant: false },
  { value: "cash", label: "Espèces", comptant: true },
  { value: "bank_transfer", label: "Virement bancaire", comptant: false },
];

export function getPaymentMethodMeta(method: string) {
  return PAYMENT_METHODS.find((entry) => entry.value === method) ?? PAYMENT_METHODS[0];
}

export type PaymentMode = "simulation" | "live";

/**
 * Mode courant.
 *
 * En simulation, les regles sont reellement appliquees mais aucun appel ne sort :
 * c est le meme chemin de code qui traitera le webhook en production, alimenté
 * par une source locale.
 */
export function getPaymentMode(): PaymentMode {
  return process.env.NEXT_PUBLIC_PAYMENT_MODE === "live" ? "live" : "simulation";
}

export function isSimulation(): boolean {
  return getPaymentMode() === "simulation";
}