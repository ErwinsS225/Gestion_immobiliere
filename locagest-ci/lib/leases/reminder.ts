import { normaliserWhatsapp } from "@/lib/tenants/whatsapp";

/**
 * Messages de relance WhatsApp.
 *
 * Le texte est produit côté serveur, à partir des montants réellement
 * enregistrés en base : l'agent ne saisit pas le texte, il ne peut donc pas
 * annoncer une somme différente de celle attendue.
 *
 * Ton retenu : direct et correct. Un agent ne veut pas d'un texte d'excuses, il
 * veut un message que le locataire lit et comprend en une phrase.
 */

export interface DonneesRelance {
  prenomOuNom?: string | null;
  nomAgence?: string | null;
  /** Mois et année au format « octobre 2026 ». */
  periode: string;
  /** Montant total de l'échéance. */
  totalEcheance: number;
  /** Part déjà encaissée. */
  dejaEncaisse: number;
  /** Montant restant. */
  reste: number;
  /** Nombre de jours de retard, nul si l'échéance n'est pas échue. */
  joursRetard: number;
}

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

export function formatPeriode(mois: number, annee: number): string {
  return `${MOIS[mois - 1] ?? mois} ${annee}`;
}

function montantFr(valeur: number): string {
  return `${Math.round(valeur).toLocaleString("fr-FR")} FCFA`;
}

/** Formule d'appel respectueuse, puis rappel du montant et de la demande. */
export function messageRelanceImpayé(donnees: DonneesRelance): string {
  const appel = donnees.prenomOuNom?.trim() || "Madame, Monsieur";

  if (donnees.joursRetard > 0) {
    const jours = donnees.joursRetard === 1 ? "1 jour" : `${donnees.joursRetard} jours`;
    return (
      `Bonjour ${appel},\n\n` +
      `Sauf erreur de notre part, le loyer de ${donnees.periode} n'a pas encore été reçu. ` +
      `Il est en retard de ${jours}.\n\n` +
      `Reste à régler : ${montantFr(donnees.reste)}\n\n` +
      `Pourriez-vous nous confirmer quand ce règlement sera effectué ? ` +
      `Nous restons à votre disposition pour convenir d'un échéancier si nécessaire.\n\n` +
      (donnees.nomAgence ? `Cordialement,\n${donnees.nomAgence}` : "Cordialement")
    );
  }

  return (
    `Bonjour ${appel},\n\n` +
    `Nous vous rappelons le loyer de ${donnees.periode}, dû à cette date.\n\n` +
    `Montant attendu : ${montantFr(donnees.totalEcheance)}\n\n` +
    (donnees.nomAgence ? `Cordialement,\n${donnees.nomAgence}` : "Cordialement")
  );
}

/** Rappel d'une échéance non soldée mais pas encore en retard. */
export function messageRappelEcheance(donnees: DonneesRelance): string {
  const appel = donnees.prenomOuNom?.trim() || "Madame, Monsieur";
  const part = donnees.dejaEncaisse > 0
    ? `Déjà reçu : ${montantFr(donnees.dejaEncaisse)}. `
    : "";

  return (
    `Bonjour ${appel},\n\n` +
    `Le loyer de ${donnees.periode} arrive à échéance.\n\n` +
    `${part}Reste à régler : ${montantFr(donnees.reste)}\n\n` +
    (donnees.nomAgence ? `Cordialement,\n${donnees.nomAgence}` : "Cordialement")
  );
}

/**
 * Construit le lien WhatsApp, message compris.
 *
 * Le lien est renvoyé null si le numéro n'est pas exploitable : l'appelant
 * doit alors proposer un appel téléphonique plutôt qu'un bouton muet.
 */
export function lienRelance(donnees: DonneesRelance): string | null {
  const message =
    donnees.joursRetard > 0
      ? messageRelanceImpayé(donnees)
      : messageRappelEcheance(donnees);

  // Le texte est encodé pour wa.me : sans cela, un point ou un accent casse
  // silencieusement le lien.
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Variante combinant un numéro saisi et un message déjà choisi. */
export function lienRelancePour(numero: string | null, donnees: DonneesRelance): string | null {
  const { international, valide } = normaliserWhatsapp(numero);
  if (!valide) return null;

  const message =
    donnees.joursRetard > 0 ? messageRelanceImpayé(donnees) : messageRappelEcheance(donnees);

  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}