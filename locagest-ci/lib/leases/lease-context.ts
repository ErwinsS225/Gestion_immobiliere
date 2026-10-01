import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/supabase/organization-context";
import { databaseErrorResponse } from "@/lib/supabase/organization-context";

/**
 * Resout le bail demande et verifie qu il appartient bien a l organisation
 * courante.
 *
 * L organization_id n est jamais accepte depuis le client : il est relu en base.
 * Un bail d une autre agence est donc introuvable, pas seulement interdit.
 */
export async function resolveLease(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  leaseId: string,
  organizationId: string,
) {
  return supabase
    .from("leases")
    .select("id, organization_id, unit_id, tenant_id, status")
    .eq("id", leaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

export async function leaseContext(write: boolean) {
  return requireOrganization(write);
}

export { databaseErrorResponse };

export function leaseNotFound() {
  return NextResponse.json(
    { error: "Ce bail est introuvable dans votre agence." },
    { status: 404 },
  );
}

export function serviceUnavailable() {
  return NextResponse.json(
    { error: "Le service est momentanément indisponible." },
    { status: 503 },
  );
}

export function readJson(request: Request) {
  return request.json().catch(() => null);
}
