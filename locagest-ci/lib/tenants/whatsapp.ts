/**
 * Normalisation d'un numéro ivoirien pour un lien WhatsApp.
 *
 * WhatsApp attend le numéro au format international, sans signe ni séparateur.
 * Un numéro local comme 0585231985 n'ouvre aucun contact : il faut le préfixer
 * de l'indicatif pays, ici +225 pour la Côte d'Ivoire.
 *
 * La forme saisie est libre : l'agent peut taper 05 85 23 19 85, +225585231985,
 * 00225585231985 ou (225) 05-85-23-19-85. Les trois cas doivent produire le même
 * lien, sinon la relance échoue silencieusement sur un simple espace en trop.
 */

const INDICATIF = "225";

/** Longueur d'un numéro ivoirien national, préfixe 0 compris. */
const LONGUEUR_NATIONALE = 10;

export interface NormalisationNumeros {
  /** Numéro au format international, prêt pour wa.me. */
  international: string;
  /** Vrai si le numéro a pu être normalisé. */
  valide: boolean;
  /** Raison de l'échec, à afficher si valide est faux. */
  raison?: string;
}

/** Ne conserve que les chiffres. */
function seulementChiffres(valeur: string): string {
  return valeur.replace(/\D/g, "");
}

export function normaliserWhatsapp(saisie: string | null | undefined): NormalisationNumeros {
  if (!saisie || !saisie.trim()) {
    return { international: "", valide: false, raison: "Aucun numéro renseigné." };
  }

  const brut = seulementChiffres(saisie);
  if (!brut) {
    return { international: "", valide: false, raison: "Le numéro ne contient aucun chiffre." };
  }

  // La saisie est internationale si elle porte un indicatif pays explicite.
  // Deux écritures coexistent : le préfixe 00 en accès, et le préfixe 225
  // collé au numéro national, qui laisse le zéro initial en place
  // (2250585231985 pour 05 85 23 19 85).
  let international = "";

  if (brut.startsWith("00")) {
    international = brut.slice(2);
  } else if (
    brut.startsWith(INDICATIF) &&
    brut.length === INDICATIF.length + LONGUEUR_NATIONALE
  ) {
    // 2250585231985 : l'indicatif est collé au numéro national, le zéro
    // initial reste donc en place et doit être retiré.
    international = `${INDICATIF}${brut.slice(INDICATIF.length + 1)}`;
  } else if (brut.startsWith(INDICATIF) && brut.length > LONGUEUR_NATIONALE) {
    // Numéro étranger ou déjà international : le préfixe est conservé tel quel,
    // un locataire expatrié doit rester joignable.
    international = brut;
  }

  if (international) {
    if (/^[1-9]\d{7,14}$/.test(international)) {
      return { international, valide: true };
    }
    return {
      international: "",
      valide: false,
      raison: "Numéro international incomplet.",
    };
  }

  // Aucun préfixe reconnu : soit le numéro est national, soit il est étranger
  // et l'agent a oublié le signe plus. Les deux cas sont départageables :
  // un numéro national ivoirien fait exactement dix chiffres et commence par
  // zéro, un numéro étranger fait plus longtemps et commence par un chiffre
  // de pays supérieur à 1.
  if (brut.length === LONGUEUR_NATIONALE && brut.startsWith("0")) {
    return { international: `${INDICATIF}${brut.slice(1)}`, valide: true };
  }

  if (/^[2-9]\d{7,14}$/.test(brut)) {
    // Saisie sans le signe plus d'un numéro étranger : il est rendu tel quel
    // plutôt que refusé, un expatrié devant rester joignable.
    return { international: brut, valide: true };
  }

  return {
    international: "",
    valide: false,
    raison:
      "Numéro attendu : 10 chiffres commençant par 0, par exemple 07 00 00 00 00, ou un numéro international commençant par +.",
  };
}

/** Construit l'URL de relance WhatsApp pour un numéro. */
export function lienWhatsapp(saisie: string | null | undefined): string | null {
  const { international, valide } = normaliserWhatsapp(saisie);
  return valide ? `https://wa.me/${international}` : null;
}