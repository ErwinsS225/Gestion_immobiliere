import { describe, expect, it } from "vitest";
import {
  formatPeriode,
  lienRelance,
  lienRelancePour,
  messageRappelEcheance,
  messageRelanceImpayé,
} from "@/lib/leases/reminder";

// Le message part en production : un montant faux ou un texte tronqué se
// retrouve chez le locataire. Les tests fixent le contenu et l'encodage.

const DONNEES = {
  prenomOuNom: "M. Kouassi",
  nomAgence: "Agence Kouassi Immobilier",
  periode: "octobre 2026",
  totalEcheance: 175000,
  dejaEncaisse: 0,
  reste: 175000,
  joursRetard: 12,
};

describe("formatage de la période", () => {
  it("écrit le mois en toutes lettres", () => {
    expect(formatPeriode(1, 2026)).toBe("janvier 2026");
    expect(formatPeriode(10, 2026)).toBe("octobre 2026");
    expect(formatPeriode(12, 2026)).toBe("décembre 2026");
  });
});

describe("message de relance d'un impayé", () => {
  it("annonce le montant restant et la période", () => {
    const message = messageRelanceImpayé(DONNEES);
    expect(message).toContain("octobre 2026");
    expect(message).toContain("12 jours");
  });

  it("s'adresse au locataire par son nom", () => {
    expect(messageRelanceImpayé(DONNEES)).toContain("Bonjour M. Kouassi");
  });

  it("reste courtois en l'absence de nom", () => {
    const message = messageRelanceImpayé({ ...DONNEES, prenomOuNom: null });
    expect(message).toContain("Madame, Monsieur");
  });

  it("singulie le jour quand le retard est d'un seul jour", () => {
    expect(messageRelanceImpayé({ ...DONNEES, joursRetard: 1 })).toContain("1 jour");
  });

  it("propose un échéancier plutôt qu'un ton sec", () => {
    expect(messageRelanceImpayé(DONNEES)).toContain("échéancier");
  });

  it("termine par le nom de l'agence", () => {
    expect(messageRelanceImpayé(DONNEES)).toContain("Agence Kouassi Immobilier");
  });

  it("ne mentionne pas de retard quand il n'y en a pas", () => {
    const message = messageRelanceImpayé({ ...DONNEES, joursRetard: 0 });
    expect(message).not.toContain("en retard");
  });
});

describe("message de rappel d'échéance", () => {
  it("rappelle le montant attendu", () => {
    const message = messageRappelEcheance({ ...DONNEES, joursRetard: 0 });
    expect(message).toContain("arrive à échéance");
  });

  it("rappelle la part déjà encaissée", () => {
    const message = messageRappelEcheance({
      ...DONNEES,
      dejaEncaisse: 75000,
      reste: 100000,
      joursRetard: 0,
    });
    expect(message).toContain("Déjà reçu");
  });
});

describe("montants dans le message", () => {
  it("formate les milliers avec le séparateur français", () => {
    // Le séparateur de fr-FR est l'espace fine insécable U+202F, pas une espace
    // ordinaire : la chaîne attendue est construite, sinon le test ne prouve
    // rien et échoue sans raison apparente.
    const attendu = `175${String.fromCharCode(0x202f)}000 FCFA`;
    expect(messageRelanceImpayé(DONNEES)).toContain(attendu);
    // Aucune quantité ne doit apparaître sans son séparateur.
    expect(messageRelanceImpayé(DONNEES)).not.toContain("175000");
  });

  it("formate les parties d'un règlement partiel", () => {
    const fine = String.fromCharCode(0x202f);
    const message = messageRappelEcheance({
      ...DONNEES,
      dejaEncaisse: 75000,
      reste: 100000,
      joursRetard: 0,
    });
    expect(message).toContain(`75${fine}000 FCFA`);
    expect(message).toContain(`100${fine}000 FCFA`);
  });
});

describe("lien de relance", () => {
  it("inclut le message encodé dans l'URL", () => {
    const lien = lienRelance(DONNEES);
    expect(lien).not.toBeNull();
    expect(lien).toContain("wa.me/?text=");
    // Les espaces ne doivent jamais rester bruts dans une URL.
    expect(lien).not.toMatch(/\?text=[^&]*[ ]/);
  });

  it("retrouve le texte une fois décodé", () => {
    const lien = lienRelance(DONNEES) as string;
    const texte = decodeURIComponent(lien.split("text=")[1]);
    expect(texte).toBe(messageRelanceImpayé(DONNEES));
  });

  it("retombe sur le rappel quand il n'y a pas de retard", () => {
    const lien = lienRelance({ ...DONNEES, joursRetard: 0 }) as string;
    const texte = decodeURIComponent(lien.split("text=")[1]);
    expect(texte).toBe(messageRappelEcheance({ ...DONNEES, joursRetard: 0 }));
  });

  it("construit un lien par numéro", () => {
    const lien = lienRelancePour("0585231985", DONNEES);
    expect(lien).toContain("wa.me/225585231985");
  });

  it("produit un message complet pour un impayé réel", () => {
    // Vérification du rendu final tel qu'il arrivera chez le locataire.
    const lien = lienRelancePour("0585231985", DONNEES) as string;
    const texte = decodeURIComponent(lien.split("text=")[1]);
    expect(texte).toBe(messageRelanceImpayé(DONNEES));
    expect(texte).toContain("Reste à régler");
    expect(texte).toContain("Cordialement");
  });

  it("rend null quand le numéro est inexploitable", () => {
    expect(lienRelancePour("123", DONNEES)).toBeNull();
    expect(lienRelancePour(null, DONNEES)).toBeNull();
  });
});