import { describe, expect, it } from "vitest";
import { buildMoveInPreview, leaseFormSchema } from "@/lib/validations/lease";

// Le contrat doit refuser les actes contraires a la loi 2019-576 avant meme
// d aller en base, avec un message que l agent peut corriger. La base reste
// la reference opposable : ces tests verifient le confort, la migration 6
// verifie la contrainte.

const LOCATAIRE = "11111111-1111-4111-8111-111111111111";
const LOT = "22222222-2222-4222-8222-222222222222";

function base(overrides: Record<string, unknown> = {}) {
  return {
    unitId: LOT,
    tenantId: LOCATAIRE,
    startDate: "2026-10-15",
    endDate: "",
    rentAmount: 150000,
    chargesAmount: 25000,
    depositAmount: 300000,
    paymentDay: 5,
    ...overrides,
  };
}

function messagePour(valeurs: Record<string, unknown>, champ: string) {
  const resultat = leaseFormSchema.safeParse(valeurs);
  if (resultat.success) return null;
  const issue = resultat.error.issues.find((item) => item.path[0] === champ);
  return issue?.message ?? null;
}

describe("location et periodes", () => {
  it("accepte un bail valide", () => {
    expect(leaseFormSchema.safeParse(base()).success).toBe(true);
  });

  it("normalise une date de fin vide en null", () => {
    const resultat = leaseFormSchema.safeParse(base({ endDate: "" }));
    expect(resultat.success).toBe(true);
    if (resultat.success) expect(resultat.data.endDate).toBeNull();
  });

  it("refuse une date de fin anterieure au debut", () => {
    expect(messagePour(base({ endDate: "2026-10-01" }), "endDate")).toContain(
      "après la date de début",
    );
  });

  it("refuse un format de date invalide", () => {
    expect(messagePour(base({ startDate: "15/10/2026" }), "startDate")).toContain(
      "AAAA-MM-JJ",
    );
  });

  it("refuse un identifiant qui n est pas un uuid", () => {
    expect(messagePour(base({ unitId: "pas-un-uuid" }), "unitId")).toBeTruthy();
  });
});

describe("depôt de garantie, plafond de l article 416", () => {
  it("accepte un depot egal a deux mois de loyer", () => {
    expect(
      leaseFormSchema.safeParse(base({ rentAmount: 150000, depositAmount: 300000 })).success,
    ).toBe(true);
  });

  it("refuse un depot superieur a deux mois de loyer", () => {
    const message = messagePour(base({ rentAmount: 150000, depositAmount: 300001 }), "depositAmount");
    expect(message).toContain("deux mois de loyer");
    expect(message).toContain("416");
  });

  it("calcule le plafond sur le loyer seul", () => {
    // Charges elevees : le plafond reste deux fois le loyer.
    expect(
      leaseFormSchema.safeParse(
        base({ rentAmount: 100000, chargesAmount: 400000, depositAmount: 200000 }),
      ).success,
    ).toBe(true);
    expect(
      leaseFormSchema.safeParse(
        base({ rentAmount: 100000, chargesAmount: 400000, depositAmount: 200001 }),
      ).success,
    ).toBe(false);
  });
});

describe("montants", () => {
  it("refuse un loyer nul", () => {
    expect(messagePour(base({ rentAmount: 0 }), "rentAmount")).toBeTruthy();
  });

  it("refuse un montant decimal", () => {
    expect(messagePour(base({ rentAmount: 150000.5 }), "rentAmount")).toContain("entier");
  });

  it("convertit une chaine vide en zero pour les charges", () => {
    const resultat = leaseFormSchema.safeParse(base({ chargesAmount: "", depositAmount: "" }));
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.chargesAmount).toBe(0);
      expect(resultat.data.depositAmount).toBe(0);
    }
  });
});

describe("reglages de prorata", () => {
  it("applique les valeurs par defaut", () => {
    const resultat = leaseFormSchema.safeParse(base());
    expect(resultat.success).toBe(true);
    if (resultat.success) {
      expect(resultat.data.prorataMode).toBe("days_remaining");
      expect(resultat.data.prorataBasis).toBe("calendar_month");
    }
  });

  it("refuse un mode inconnu", () => {
    expect(messagePour(base({ prorataMode: "prorata_inventé" }), "prorataMode")).toBeTruthy();
  });

  it("refuse une base inconnue", () => {
    expect(messagePour(base({ prorataBasis: "annee_bissextile" }), "prorataBasis")).toBeTruthy();
  });
});

describe("revision du loyer, article 455", () => {
  it("refuse un taux superieur a 20 %", () => {
    expect(messagePour(base({ revisionRate: 35 }), "revisionRate")).toContain("20");
  });

  it("accepte un taux de 5 %", () => {
    expect(leaseFormSchema.safeParse(base({ revisionRate: 5 })).success).toBe(true);
  });
});

describe("buildMoveInPreview", () => {
  it("reproduit le recapitulatif du cahier des charges", () => {
    const recap = buildMoveInPreview({
      rentAmount: 150000,
      chargesAmount: 25000,
      depositAmount: 300000,
      startDate: "2026-10-15",
    });
    expect(recap.prorata.occupiedDays).toBe(17);
    expect(recap.rentPart).toBe(Math.round((150000 * 17) / 31));
    expect(recap.firstMonthTotal).toBe(recap.rentPart + recap.chargesPart);
    expect(recap.moveInTotal).toBe(recap.firstMonthTotal + 300000);
  });

  it("retombe sur les valeurs par defaut si le mode est inconnu", () => {
    const recap = buildMoveInPreview({
      rentAmount: 150000,
      chargesAmount: 25000,
      depositAmount: 300000,
      startDate: "2026-10-15",
      prorataMode: "inventé",
      prorataBasis: "inventé",
    });
    expect(recap.prorata.mode).toBe("days_remaining");
    expect(recap.prorata.basis).toBe("calendar_month");
  });

  it("signale un depot hors plafond dans le recapitulatif", () => {
    const recap = buildMoveInPreview({
      rentAmount: 150000,
      chargesAmount: 0,
      depositAmount: 400000,
      startDate: "2026-10-01",
    });
    expect(recap.depositIsLegal).toBe(false);
    expect(recap.maxDeposit).toBe(300000);
  });

  it("annonce le garde-fou quand il force le mois plein", () => {
    const recap = buildMoveInPreview({
      rentAmount: 175000,
      chargesAmount: 0,
      depositAmount: 0,
      startDate: "2026-10-31",
      prorataBasis: "thirty_day_month",
    });
    expect(recap.prorata.safetyApplied).toBe(true);
    expect(recap.firstMonthTotal).toBe(175000);
  });
});
