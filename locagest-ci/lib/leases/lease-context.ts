import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/supabase/organization-context";
import { databaseErrorResponse } from "@/lib/supabase/organization-context";

type Supabase = Awaited<
  ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>
>;

/**
 * Resout un bail demande et verifie qu il appartient a l organisation courante.
 *
 * L organization_id n est jamais accepte depuis le client : il est relu en base.
 * Un bail d une autre agence est donc introuvable, pas seulement interdit.
 */
export async function resolveLease(supabase: Supabase, leaseId: string, organizationId: string) {
  return supabase
    .from("leases")
    .select("id, organization_id, unit_id, tenant_id, status")
    .eq("id", leaseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

/**
 * Verifie qu un lot est disponible avant la signature d un bail.
 *
 * Un bail actif sur ce lot rendrait l operation impossible : mieux vaut un
 * message clair que de laisser une contrainte unique rejeter l enregistrement.
 */
export async function findOccupiedLease(
  supabase: Supabase,
  unitId: string,
  organizationId: string,
  excludeLeaseId?: string,
) {
  let requete = supabase
    .from("leases")
    .select("id, start_date, end_date")
    .eq("unit_id", unitId)
    .eq("organization_id", organizationId)
    .eq("status", "active");

  if (excludeLeaseId) requete = requete.neq("id", excludeLeaseId);

  const { data, error } = await requete.limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export function unitNotAvailable() {
  return NextResponse.json(
    { error: "Ce lot est déjà occupé par un bail actif. Résiliez-le avant d’en créer un nouveau." },
    { status: 409 },
  );
}

export function tenantNotFound() {
  return NextResponse.json(
    { error: "Ce locataire est introuvable dans votre agence." },
    { status: 404 },
  );
}

export function unitNotFound() {
  return NextResponse.json(
    { error: "Ce lot est introuvable dans votre agence." },
    { status: 404 },
  );
}

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

/** Lit un corps JSON sans faire tomber la requete sur un corps vide. */
export async function readJson(request: Request) {
  return request.json().catch(() => null);
}

export { requireOrganization, databaseErrorResponse };
export type { Supabase };

