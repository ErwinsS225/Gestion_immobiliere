import { describe, expect, it } from "vitest";
import { lienWhatsapp, normaliserWhatsapp } from "@/lib/tenants/whatsapp";

// WhatsApp ouvre un contact uniquement si le numero est au format
// international. Un numero local saisi tel quel ouvre un lien muet : la relance
// semble partir alors que le locataire ne recoit rien.

describe("normalisation du numéro ivoirien", () => {
  it("accepte un numéro national et lui ajoute l'indicatif", () => {
    // 05 85 23 19 85 est un numéro fixe ou mobile de certains opérateurs.
    expect(normaliserWhatsapp("0585231985").international).toBe("225585231985");
  });

  it("rend le même résultat quelle que soit la mise en forme", () => {
    const attendu = "225585231985";
    for (const saisie of [
      "0585231985",
      "05 85 23 19 85",
      "05-85-23-19-85",
      "+225585231985",
      "+225 585 23 19 85",
      "00225585231985",
      "(+225) 05-85-23-19-85",
    ]) {
      expect(normaliserWhatsapp(saisie).international).toBe(attendu);
    }
  });

  it("accepte les trois premiers chiffres des opérateurs mobiles", () => {
    for (const numero of ["0700000000", "0500000000", "0100000000"]) {
      expect(normaliserWhatsapp(numero).valide).toBe(true);
    }
  });

  it("refuse un numéro trop court", () => {
    const resultat = normaliserWhatsapp("0585231");
    expect(resultat.valide).toBe(false);
    expect(resultat.international).toBe("");
  });

  it("refuse un numéro trop long", () => {
    expect(normaliserWhatsapp("05852319851").valide).toBe(false);
  });

  it("refuse un numéro sans chiffre", () => {
    expect(normaliserWhatsapp("abc").valide).toBe(false);
  });

  it("refuse une saisie vide", () => {
    expect(normaliserWhatsapp("").valide).toBe(false);
    expect(normaliserWhatsapp(null).valide).toBe(false);
  });

  it("donne une raison lisible quand le numéro est refusé", () => {
    expect(normaliserWhatsapp("123").raison).toContain("10 chiffres");
  });

  it("ne confond pas un numéro étranger sans l'indicatif ivoirien", () => {
    // 33612345678 est un numéro français : le préfixe doit rester 336 et non
    // être réinterprété comme un numéro ivoirien.
    const resultat = normaliserWhatsapp("+33612345678");
    expect(resultat.international).toBe("33612345678");
  });
});

describe("lien WhatsApp", () => {
  it("construit un lien à partir d'un numéro national", () => {
    expect(lienWhatsapp("0585231985")).toBe("https://wa.me/225585231985");
  });

  it("rend null pour un numéro inutilisable", () => {
    expect(lienWhatsapp("123")).toBeNull();
    expect(lienWhatsapp(null)).toBeNull();
  });
});