import { NextResponse } from "next/server";
import {
  leaseContext,
  leaseNotFound,
  resolveLease,
  serviceUnavailable,
} from "@/lib/leases/lease-context";
import { databaseErrorResponse } from "@/lib/supabase/organization-context";

/**
 * Supprime un objet de l'inventaire d'un bail.
 *
 * La suppression est scopee sur l'organisation ET sur le bail : un identifiant
 * d'une autre agence ne trouve aucune ligne, donc ne supprime rien.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  try {
    const { id: leaseId, itemId } = await params;
    const context = await leaseContext(true);
    if (context.response) return context.response;

    const { data: lease, error: leaseError } = await resolveLease(
      context.supabase,
      leaseId,
      context.organizationId,
    );
    if (leaseError) {
      return databaseErrorResponse(leaseError, "Impossible de vérifier ce bail.");
    }
    if (!lease) return leaseNotFound();

    const { data, error } = await context.supabase
      .from("inventory_items")
      .delete()
      .eq("id", itemId)
      .eq("lease_id", lease.id)
      .eq("organization_id", context.organizationId)
      .select("id")
      .maybeSingle();

    if (error) {
      return databaseErrorResponse(error, "Impossible de supprimer cet objet.");
    }
    if (!data) {
      return NextResponse.json(
        { error: "Cet objet est introuvable dans ce bail." },
        { status: 404 },
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return serviceUnavailable();
  }
}
