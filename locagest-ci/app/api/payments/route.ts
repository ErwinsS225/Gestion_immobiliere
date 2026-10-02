import { NextResponse } from "next/server";
import {
  databaseErrorResponse,
  readJson,
  requireOrganization,
} from "@/lib/leases/lease-context";
import { validationErrorResponse } from "@/lib/supabase/organization-context";
import { demanderPaiement } from "@/lib/payments/gateway";
import { isSimulation } from "@/lib/payments/mode";
import { paymentSchema } from "@/lib/validations/payments";

/**
 * Enregistre un règlement sur une échéance.
 *
 * Le chemin est identique dans les deux modes : la demande passe par le point
 * de bascule `demanderPaiement`, qui simule en local et appelle l'opérateur en
 * production. Le reste ne dépend d'aucun des deux.
 *
 * La référence est retournée à l'agent dans les deux cas : elle est ce qu'il
 * 注 lors d'un litige, et ce que l'opérateur citera au téléphone.
 */
export async function POST(request: Request) {
  try {
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const parsed = paymentSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du règlement.");
    }

    const { rentCallId, amount, method, paidAt, notes, rejectionReason } = parsed.data;

    // L'échéance est relue et scopée à l'organisation : un identifiant d'une
    // autre agence ne trouve aucune ligne.
    const { data: echeance, error: echeanceError } = await context.supabase
      .from("rent_calls")
      .select("id, lease_id, total_amount, amount_paid, status, leases ( id, tenant_id )")
      .eq("id", rentCallId)
      .eq("organization_id", context.organizationId)
      .maybeSingle();

    if (echeanceError) {
      return databaseErrorResponse(echeanceError, "Impossible de vérifier cette échéance.");
    }
    if (!echeance) {
      return NextResponse.json(
        { error: "Cette échéance est introuvable dans votre agence." },
        { status: 404 },
      );
    }

    const bail = echeance.leases as unknown as { id: string; tenant_id: string } | null;
    if (!bail) {
      return NextResponse.json(
        { error: "Cette échéance n’est rattachée à aucun bail." },
        { status: 409 },
      );
    }

    const { data: locataire } = await context.supabase
      .from("tenants")
      .select("phone")
      .eq("id", bail.tenant_id)
      .maybeSingle();

    const demande = await demanderPaiement({
      amount,
      method,
      paidAt: new Date(`${paidAt}T12:00:00Z`),
      tenantPhone: locataire?.phone ?? null,
      organizationId: context.organizationId,
    });

    // Un rejet est enregistré sans montant : l'échéance doit rester telle quelle,
    // et non être diminuée d'une somme qui n'a jamais été encaissée.
    if (rejectionReason) {
      const { data: rejet, error } = await context.supabase
        .from("payments")
        .insert({
          organization_id: context.organizationId,
          rent_call_id: echeance.id,
          amount: 0,
          method,
          reference: demande.reference,
          paid_at: paidAt,
          notes,
          rejection_reason: rejectionReason,
          status: "rejected",
        })
        .select("id, reference")
        .single();

      if (error || !rejet) {
        return databaseErrorResponse(error ?? {}, "Impossible d’enregistrer le rejet.");
      }

      return NextResponse.json(
        { id: rejet.id, reference: rejet.reference, rejected: true },
        { status: 201 },
      );
    }

    const { data: paiement, error: insertError } = await context.supabase
      .from("payments")
      .insert({
        organization_id: context.organizationId,
        rent_call_id: echeance.id,
        amount,
        method,
        reference: demande.reference,
        paid_at: paidAt,
        notes,
        status: demande.status === "confirmed" ? "confirmed" : "pending",
      })
      .select("id, reference")
      .single();

    if (insertError || !paiement) {
      return databaseErrorResponse(insertError ?? {}, "Impossible d’enregistrer le règlement.");
    }

    // Le trigger de la migration 2 recalcule amount_paid et le statut de
    // l'échéance à partir des paiements confirmés : rien à faire ici.
    return NextResponse.json(
      {
        id: paiement.id,
        reference: paiement.reference,
        simulation: isSimulation(),
        redirectUrl: demande.redirectUrl,
        providerMessage: demande.providerMessage,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith("L'opérateur")
        ? error.message
        : "Le service est momentanément indisponible.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}