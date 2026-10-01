import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRORATA_BASIS,
  DEFAULT_PRORATA_MODE,
  MAX_DEPOSIT_MONTHS,
  MAX_RENT_ADVANCE_MONTHS,
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

describe("base de calcul : mois reel contre mois de 30 jours", () => {
  it("divise par le nombre reel de jours avec le mois reel", () => {
    const resultat = computeProrata(175_000, "2026-10-15", "days_remaining", "calendar_month");
    expect(resultat.totalDays).toBe(31);
    expect(resultat.amount).toBe(Math.round((175_000 * 17) / 31));
  });

  it("divise par 30 avec le mois de 30 jours", () => {
    const resultat = computeProrata(175_000, "2026-10-15", "days_remaining", "thirty_day_month");
    expect(resultat.totalDays).toBe(30);
    expect(resultat.amount).toBe(Math.round((175_000 * 17) / 30));
  });

  it("majore le prorata d environ 3 % avec le mois de 30 jours", () => {
    const reel = computeProrata(175_000, "2026-10-15", "days_remaining", "calendar_month");
    const commercial = computeProrata(175_000, "2026-10-15", "days_remaining", "thirty_day_month");
    expect(commercial.amount).toBeGreaterThan(reel.amount);
    const ecart = (commercial.amount - reel.amount) / reel.amount;
    expect(ecart).toBeGreaterThan(0.02);
    expect(ecart).toBeLessThan(0.05);
  });

  it("uniformise le denominateur a 30 quel que soit le mois", () => {
    // Octobre compte 31 jours et avril 30. Les journees occupees ne sont donc
    // pas les memes : 17 en octobre, 16 en avril. Ce qui doit etre identique,
    // c est le denominateur, 30 dans les deux cas. On compare donc le prorata
    // d un meme nombre de journees dans deux mois de longueurs differentes.
    const octobre = computeProrata(150_000, "2026-10-16", "days_remaining", "thirty_day_month");
    const avril = computeProrata(150_000, "2026-04-16", "days_remaining", "thirty_day_month");

    expect(octobre.occupiedDays).toBe(16); // 31 - 16 + 1
    expect(avril.occupiedDays).toBe(15); // 30 - 16 + 1
    expect(octobre.totalDays).toBe(30);
    expect(avril.totalDays).toBe(30);

    // Chaque montant suit bien son propre nombre de journees sur 30.
    expect(octobre.amount).toBe(Math.round((150_000 * 16) / 30));
    expect(avril.amount).toBe(Math.round((150_000 * 15) / 30));
  });

  it("donne le meme montant pour une meme journee dans deux mois differents", () => {
    // Deux baux d une seule journee, l un en octobre, l autre en avril :
    // la base de 30 jours donne le meme resultat, la base reelle non.
    const octobre = computeProrata(150_000, "2026-10-31", "days_remaining_plus_one", "thirty_day_month");
    const avril = computeProrata(150_000, "2026-04-30", "days_remaining_plus_one", "thirty_day_month");

    // Le garde-fou s applique en base 30 jours sur ces occupations courtes.
    expect(octobre.safetyApplied).toBe(true);
    expect(avril.safetyApplied).toBe(true);
    expect(octobre.amount).toBe(avril.amount);
  });

  it("applique le garde-fou sur une occupation trop courte", () => {
    // Bail le 31 octobre : 1 jour sur 30 ferait pres d un tiers du loyer pour une
    // seule journee d occupation. Le mois plein est retenu.
    const resultat = computeProrata(175_000, "2026-10-31", "days_remaining", "thirty_day_month");
    expect(resultat.safetyApplied).toBe(true);
    expect(resultat.isFullMonth).toBe(true);
    expect(resultat.amount).toBe(175_000);
  });

  it("n applique pas le garde-fou quand l occupation est suffisante", () => {
    const resultat = computeProrata(175_000, "2026-10-15", "days_remaining", "thirty_day_month");
    expect(resultat.safetyApplied).toBe(false);
    expect(resultat.isFullMonth).toBe(false);
  });

  it("ne declenche pas le garde-fou en mois reel pour un bail le 31", () => {
    // 1 jour sur 31 reste sous le seuil : le prorata est conserve.
    const resultat = computeProrata(150_000, "2026-10-31", "days_remaining", "calendar_month");
    expect(resultat.safetyApplied).toBe(false);
    expect(resultat.amount).toBe(Math.round(150_000 / 31));
  });

  it("ne prorate pas un bail demarrant le 1er, quelle que soit la base", () => {
    for (const basis of ["calendar_month", "thirty_day_month"] as const) {
      const resultat = computeProrata(175_000, "2026-10-01", "days_remaining", basis);
      expect(resultat.amount).toBe(175_000);
      expect(resultat.safetyApplied).toBe(false);
    }
  });
});

describe("cadre juridique applique", () => {
  it("retient les plafonds des articles 415, 416 et 455", () => {
    expect(MAX_DEPOSIT_MONTHS).toBe(2);
    expect(MIN_REVISION_YEARS).toBe(3);
    expect(MAX_RENT_ADVANCE_MONTHS).toBe(2);
  });

  it("applique par defaut les jours restants et le mois reel", () => {
    expect(DEFAULT_PRORATA_MODE).toBe("days_remaining");
    expect(DEFAULT_PRORATA_BASIS).toBe("calendar_month");
  });
});

