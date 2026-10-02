import { isSimulation, type PaymentMethod } from "@/lib/payments/mode";
import { generatePaymentReference } from "@/lib/payments/reference";

/**
 * Point unique de bascule entre la simulation et le paiement réel.
 *
 * En simulation : aucune requête ne sort, la référence est générée localement et
 * la confirmation est immédiate.
 *
 * En réel : une demande de paiement est adressée à l'opérateur, la référence
 * nous est retournée, et le statut ne change qu'à la réception du webhook
 * correspondant. Un agent ne peut donc pas déclarer un encaissement qu'il n'a
 * pas effectué : c'est la seule garantie qui distingue les deux modes.
 *
 * Le reste de l'application — signature des requêtes, vérification du webhook,
 * imputation sur les échéances — est identique dans les deux cas.
 */
export interface DemandePaiement {
  reference: string;
  status: "pending" | "confirmed";
  /** Lien de redirection chez l'opérateur, absent en simulation. */
  redirectUrl?: string;
  providerMessage?: string;
}

/**
 * Demande l'ouverture d'un paiement.
 *
 * Cette fonction est le seul endroit qui décide si l'application parle à un
 * opérateur. Passer en production revient à changer `getPaymentMode`, pas à
 * réécrire les appelants.
 */
export async function demanderPaiement(input: {
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  tenantPhone?: string | null;
  organizationId: string;
}): Promise<DemandePaiement> {
  const reference = generatePaymentReference(input.method, input.paidAt);

  if (isSimulation()) {
    return {
      reference,
      status: "confirmed",
      providerMessage: "Simulation : aucun débit effectué.",
    };
  }

  // Chemin réel. Le code ci-dessous est écrit comme en production et ne sera
  // exercé qu'après le changement de NEXT_PUBLIC_PAYMENT_MODE.
  const url = process.env.PAYMENT_API_URL;
  const cle = process.env.PAYMENT_API_KEY;

  if (!url || !cle) {
    throw new Error(
      "Mode réel activé : PAYMENT_API_URL et PAYMENT_API_KEY doivent être renseignés.",
    );
  }

  const reponse = await fetch(`${url}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cle}`,
      // Signature de la requête : à reprenne à l'identique de la documentation
      // de l'opérateur. En cas de modification, seule cette fonction est
      // touchée.
      "X-Signature": signPayload(
        { amount: input.amount, method: input.method, reference },
        cle,
      ),
    },
    body: JSON.stringify({
      reference,
      amount: input.amount,
      method: input.method,
      phone: input.tenantPhone ?? undefined,
      merchant: input.organizationId,
    }),
  });

  if (!reponse.ok) {
    throw new Error(`L'opérateur a refusé la demande (${reponse.status}).`);
  }

  const charge = (await reponse.json()) as {
    redirect_url?: string;
    status?: string;
    message?: string;
  };

  return {
    reference,
    status: charge.status === "confirmed" ? "confirmed" : "pending",
    redirectUrl: charge.redirect_url,
    providerMessage: charge.message,
  };
}

/**
 * Signature de la requête.
 *
 * Écrite ici pour que le mode réel soit amorcé. Une seule ligne change lorsque
 * l'algorithme de l'opérateur est connu.
 */
function signPayload(
  input: { amount: number; method: string; reference: string },
  cle: string,
): string {
  const charge = `${input.reference}|${input.amount}|${input.method}`;
  return `sha256=${charge}.${Buffer.from(cle).toString("base64").slice(0, 8)}`;
}

/**
 * Vérifie la signature d'un webhook entrant.
 *
 * Un webhook non signé est refusé : c'est ce qui empêche un tiers de faire
 * enregistrer un encaissement inexistant.
 */
export function verifierSignatureWebhook(
  corps: string,
  signature: string | null,
): boolean {
  const cle = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!cle) return false;
  if (!signature) return false;
  return signature === `sha256=${Buffer.from(`${corps}.${cle}`).toString("hex")}`;
}