import { describe, expect, it } from "vitest";
import { paymentSchema, paymentRejectionSchema } from "@/lib/validations/payments";
import { generatePaymentReference, isPaymentReference } from "@/lib/payments/reference";
import { PAYMENT_METHODS } from "@/lib/payments/mode";

// Un reglement porte un montant, un moyen et une date. La reference n en fait
// pas partie : elle est generee par le serveur, pour qu un agent ne puisse pas
// declarer un identifiant de transaction de son choix.

const ECHEANCE = "33333333-3333-4333-8333-333333333333";

function base(overrides: Record<string, unknown> = {}) {
  return {
    rentCallId: ECHEANCE,
    amount: 160000,
    method: "wave",
    paidAt: "2026-10-15",
    notes: "",
    rejectionReason: null,
    ...overrides,
  };
}

function messagePour(valeurs: Record<string, unknown>, champ: string) {
  const resultat = paymentSchema.safeParse(valeurs);
  if (resultat.success) return null;
  return resultat.error.issues.find((item) => item.path[0] === champ)?.message ?? null;
}

describe("montant", () => {
  it("accepte un montant entier", () => {
    expect(paymentSchema.safeParse(base()).success).toBe(true);
  });

  it("refuse un montant nul", () => {
    expect(messagePour(base({ amount: 0 }), "amount")).toContain("supérieur à 0");
  });

  it("refuse un montant decimal", () => {
    expect(messagePour(base({ amount: 160000.5 }), "amount")).toContain("entier");
  });

  it("convertit une chaine vide en montant nul, donc refuse", () => {
    expect(paymentSchema.safeParse(base({ amount: "" })).success).toBe(false);
  });

  it("accepte une chaine de chiffres venue du formulaire", () => {
    expect(paymentSchema.safeParse(base({ amount: "160000" })).success).toBe(true);
  });
});

describe("moyen de paiement", () => {
  it("accepte les six moyens de la place", () => {
    expect(PAYMENT_METHODS).toHaveLength(6);
    for (const moyen of PAYMENT_METHODS) {
      expect(paymentSchema.safeParse(base({ method: moyen.value })).success).toBe(true);
    }
  });

  it("refuse un moyen inconnu", () => {
    expect(messagePour(base({ method: "bitcoin" }), "method")).toBeTruthy();
  });
});

describe("date", () => {
  it("refuse un format non ISO", () => {
    expect(messagePour(base({ paidAt: "15/10/2026" }), "paidAt")).toContain("AAAA-MM-JJ");
  });

  it("accepte une date ISO", () => {
    expect(paymentSchema.safeParse(base({ paidAt: "2026-10-01" })).success).toBe(true);
  });
});

describe("rejet d opération", () => {
  it("refuse un motif vide", () => {
    expect(messagePour(base({ rejectionReason: "" }), "rejectionReason")).toBeTruthy();
  });

  it("exige un motif explicite dans le contrat de rejet", () => {
    const resultat = paymentRejectionSchema.safeParse({
      paymentReference: "WVW-20261015-4127",
      rejectionReason: "",
    });
    expect(resultat.success).toBe(false);
  });

  it("refuse une référence mal formée dans le contrat de rejet", () => {
    const resultat = paymentRejectionSchema.safeParse({
      paymentReference: "pas-une-reference",
      rejectionReason: "Fonds insuffisants",
    });
    expect(resultat.success).toBe(false);
  });
});

describe("génération de référence", () => {
  it("respecte le format attendu par la contrainte en base", () => {
    // La contrainte payments_reference_format impose 3 lettres, 8 chiffres et
    // 4 chiffres : WV W-20261015-4127.
    for (const moyen of PAYMENT_METHODS) {
      const reference = generatePaymentReference(moyen.value, new Date("2026-10-15T12:00:00Z"));
      expect(reference).toMatch(/^[A-Z]{3}-\d{8}-\d{4}$/);
      expect(isPaymentReference(reference)).toBe(true);
    }
  });

  it("porte la date du paiement, non celle du jour de saisie", () => {
    // Un agent qui saisit en avril un reglement de mars doit obtenir une
    // reference de mars.
    const reference = generatePaymentReference("wave", new Date("2026-03-09T12:00:00Z"));
    expect(reference).toContain("20260309");
  });

  it("produit des references distinctes", () => {
    const date = new Date("2026-10-15T12:00:00Z");
    const lot = new Set(
      Array.from({ length: 40 }, () => generatePaymentReference("wave", date)),
    );
    expect(lot.size).toBeGreaterThan(35);
  });

  it("rejette une chaîne libre", () => {
    expect(isPaymentReference("pas-une-reference")).toBe(false);
    expect(isPaymentReference("WVW-2026-4127")).toBe(false);
  });
});