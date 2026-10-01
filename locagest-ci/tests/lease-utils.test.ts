import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRORATA_MODE,
  MAX_DEPOSIT_MONTHS,
  MIN_REVISION_YEARS,
  computeMoveInBreakdown,
  computeProrata,
  daysInMonth,
} from "@/lib/lease-utils";

// Tests du prorata et des plafonds legaux.
//
// Le prorata n est regi par aucune disposition ivoirienne : il s agit d un usage
// contractuel. Ces tests fixent donc le comportement attendu des trois modes, y
// compris sur les mois de 28 et 29 jours, pour qu une refactorisation ne change
// pas un montant facture au locataire.

describe("daysInMonth", () => {
  it("compte les jours reels de chaque mois", () => {
    expect(daysInMonth(2026, 1)).toBe(31); // janvier
    expect(daysInMonth(2026, 2)).toBe(28); // fevrier 2026, non bissextile
    expect(daysInMonth(2028, 2)).toBe(29); // fevrier 2028, bissextile
    expect(daysInMonth(2026, 4)).toBe(30); // avril
  });
});

describe("computeProrata, mode par defaut (jours restants inclus)", () => {
  it("facture le mois entier quand le bail commence le 1er", () => {
    const resultat = computeProrata(175_000, "2026-10-01");
    expect(resultat.isFullMonth).toBe(true);
    expect(resultat.amount).toBe(175_000);
    expect(resultat.occupiedDays).toBe(31);
  });

  it("compte le jour de début et le dernier jour du mois", () => {
    const resultat = computeProrata(175_000, "2026-10-15");
    expect(resultat.occupiedDays).toBe(17); // 31 - 15 + 1
    expect(resultat.totalDays).toBe(31);
    expect(resultat.amount).toBe(Math.round((175_000 * 17) / 31));
  });

  it("facture un seul jour pour un bail demarrant le dernier jour", () => {
    const resultat = computeProrata(150_000, "2026-10-31");
    expect(resultat.occupiedDays).toBe(1);
    expect(resultat.amount).toBe(Math.round(150_000 / 31));
  });

  it("gere fevrier non bissextile", () => {
    const resultat = computeProrata(140_000, "2026-02-20");
    expect(resultat.totalDays).toBe(28);
    expect(resultat.occupiedDays).toBe(9); // 28 - 20 + 1
    expect(resultat.amount).toBe(Math.round((140_000 * 9) / 28));
  });

  it("gere fevrier bissextile", () => {
    const resultat = computeProrata(140_000, "2028-02-20");
    expect(resultat.totalDays).toBe(29);
    expect(resultat.occupiedDays).toBe(10); // 29 - 20 + 1
    expect(resultat.amount).toBe(Math.round((140_000 * 10) / 29));
  });
});

describe("computeProrata, modes alternatifs", () => {
  it("ajoute un jour en mode jours restants + jour d entree", () => {
    const resultat = computeProrata(175_000, "2026-10-15", "days_remaining_plus_one");
    expect(resultat.occupiedDays).toBe(18);
  });

  it("facture le mois plein en mode mois plein", () => {
    const resultat = computeProrata(175_000, "2026-10-15", "full_month");
    expect(resultat.isFullMonth).toBe(true);
    expect(resultat.amount).toBe(175_000);
  });

  it("ne prorate jamais un bail demarrant le 1er, quel que soit le mode", () => {
    for (const mode of ["days_remaining", "days_remaining_plus_one", "full_month"] as const) {
      expect(computeProrata(175_000, "2026-10-01", mode).amount).toBe(175_000);
    }
  });
});

describe("computeMoveInBreakdown", () => {
  it("reproduit l exemple du cahier des charges", () => {
    // Bail le 15 octobre 2026, loyer 150 000, charges 25 000, depot 300 000.
    const recap = computeMoveInBreakdown(150_000, 25_000, 300_000, "2026-10-15");

    expect(recap.prorata.occupiedDays).toBe(17);
    expect(recap.rentPart).toBe(Math.round((150_000 * 17) / 31)); // 82 258
    expect(recap.chargesPart).toBe(Math.round((25_000 * 17) / 31)); // 13 710
    expect(recap.firstMonthTotal).toBe(recap.rentPart + recap.chargesPart);
    expect(recap.moveInTotal).toBe(recap.firstMonthTotal + 300_000);
  });

  it("additionne les parts plutot que d arrondir la somme globale", () => {
    const recap = computeMoveInBreakdown(150_000, 25_000, 300_000, "2026-10-15");
    // L arrondi de la somme (175 000 x 17 / 31) peut differer d un franc de la
    // somme des arrondis : c est la somme des lignes qui fait foi.
    expect(recap.firstMonthTotal).toBe(recap.rentPart + recap.chargesPart);
  });

  it("ne facture aucun prorata quand le bail commence le 1er", () => {
    const recap = computeMoveInBreakdown(150_000, 25_000, 300_000, "2026-10-01");
    expect(recap.firstMonthTotal).toBe(175_000);
    expect(recap.moveInTotal).toBe(475_000);
  });

  it("respecte un depot egal au plafond legal", () => {
    const recap = computeMoveInBreakdown(150_000, 25_000, 300_000, "2026-10-01");
    expect(recap.maxDeposit).toBe(150_000 * MAX_DEPOSIT_MONTHS);
    expect(recap.depositIsLegal).toBe(true);
  });

  it("signale un depot superieur au plafond de l article 416", () => {
    const recap = computeMoveInBreakdown(150_000, 25_000, 400_000, "2026-10-01");
    expect(recap.depositIsLegal).toBe(false);
    expect(recap.maxDeposit).toBe(300_000);
  });

  it("plafonne sur le loyer seul, pas sur loyer plus charges", () => {
    // Article 416 : deux mois de loyer. Des charges importantes ne relèvent pas
    // la valeur du bien, donc elles ne doivent pas elever le plafond.
    const recap = computeMoveInBreakdown(100_000, 400_000, 200_000, "2026-10-01");
    expect(recap.maxDeposit).toBe(200_000);
  });
});

describe("cadre juridique applique", () => {
  it("retient les plafonds des articles 415, 416 et 455", () => {
    expect(MAX_DEPOSIT_MONTHS).toBe(2);
    expect(MIN_REVISION_YEARS).toBe(3);
  });

  it("applique par defaut la regle des jours restants", () => {
    expect(DEFAULT_PRORATA_MODE).toBe("days_remaining");
  });
});
