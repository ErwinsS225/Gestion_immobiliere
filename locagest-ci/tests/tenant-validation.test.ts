import { describe, expect, it } from "vitest";
import { tenantSchema } from "@/lib/validations/tenants";

// Le telephone est obligatoire : WhatsApp est le canal de relance dominant en
// Cote d Ivoire, et un locataire sans numero est un locataire injoignable.

function base(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "M. Kouassi Jean-Baptiste",
    phone: "+225 05 22 22 22 22",
    whatsapp: "",
    email: "",
    idDocument: "",
    notes: "",
    ...overrides,
  };
}

function messagePour(valeurs: Record<string, unknown>, champ: string) {
  const resultat = tenantSchema.safeParse(valeurs);
  if (resultat.success) return null;
  return resultat.error.issues.find((item) => item.path[0] === champ)?.message ?? null;
}

describe("identité", () => {
  it("accepte un locataire complet", () => {
    expect(tenantSchema.safeParse(base()).success).toBe(true);
  });

  it("refuse un nom trop court", () => {
    expect(messagePour(base({ fullName: "M" }), "fullName")).toContain("2 caractères");
  });

  it("refuse un nom de plus de 120 caractères", () => {
    expect(messagePour(base({ fullName: "a".repeat(121) }), "fullName")).toContain("120");
  });
});

describe("téléphone", () => {
  it("exige un numéro", () => {
    expect(messagePour(base({ phone: "" }), "phone")).toBeTruthy();
  });

  it("refuse un numéro trop court", () => {
    expect(messagePour(base({ phone: "123" }), "phone")).toContain("6 caractères");
  });

  it("refuse les lettres", () => {
    expect(messagePour(base({ phone: "05KK22" }), "phone")).toContain("valide");
  });

  it("accepte les formats ivoiriens usuels", () => {
    for (const numero of ["+225 05 22 22 22 22", "05 22 22 22 22", "(+225) 07-00-00-00-00"]) {
      expect(tenantSchema.safeParse(base({ phone: numero })).success).toBe(true);
    }
  });
});

describe("WhatsApp", () => {
  it("reste facultatif", () => {
    const resultat = tenantSchema.safeParse(base({ whatsapp: "" }));
    expect(resultat.success).toBe(true);
    if (resultat.success) expect(resultat.data.whatsapp).toBeNull();
  });

  it("refuse un numero identique au telephone principal", () => {
    const message = messagePour(
      base({ phone: "+225 05 22 22 22 22", whatsapp: "+225 05 22 22 22 22" }),
      "whatsapp",
    );
    expect(message).toContain("différent");
  });

  it("accepte un numero different", () => {
    expect(
      tenantSchema.safeParse(
        base({ phone: "+225 05 22 22 22 22", whatsapp: "+225 07 00 00 00 00" }),
      ).success,
    ).toBe(true);
  });
});

describe("e-mail", () => {
  it("refuse une adresse malformée", () => {
    expect(messagePour(base({ email: "pas-une-adresse" }), "email")).toContain("valide");
  });

  it("accepte une adresse valide", () => {
    expect(tenantSchema.safeParse(base({ email: "kouassi@mail.ci" })).success).toBe(true);
  });
});
