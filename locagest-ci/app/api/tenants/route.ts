import { NextResponse } from "next/server";
import {
  databaseErrorResponse,
  readJson,
  requireOrganization,
  serviceUnavailable,
} from "@/lib/leases/lease-context";
import { validationErrorResponse } from "@/lib/supabase/organization-context";
import { tenantSchema } from "@/lib/validations/tenants";

/**
 * Liste des locataires de l'agence, avec le bail en cours éventuel.
 *
 * Le numéro WhatsApp n'est renvoyé que s'il est renseigné : le lien de relance
 * se construit sur ce champ, et une valeur absente doit rester absente plutôt
 * que de retomber silencieusement sur le téléphone principal.
 */
export async function GET(request: Request) {
  try {
    const context = await requireOrganization(false);
    if (context.response) return context.response;

    const url = new URL(request.url);
    const recherche = url.searchParams.get("q")?.trim();

    let requete = context.supabase
      .from("tenants")
      .select(
        "id, full_name, phone, whatsapp, email, id_document, notes, created_at, leases ( id, status, start_date, end_date, unit:units ( id, label ) )",
      )
      .eq("organization_id", context.organizationId)
      .order("full_name", { ascending: true });

    if (recherche) {
      // Le nom, le téléphone et la pièce d'identité sont cherchés ensemble : un
      // agent retient souvent l'un des trois, pas le nom exact.
      const motif = `%${recherche}%`;
      requete = requete.or(
        `full_name.ilike.${motif},phone.ilike.${motif},id_document.ilike.${motif}`,
      );
    }

    const { data: tenants, error } = await requete;
    if (error) {
      return databaseErrorResponse(error, "Impossible de charger les locataires.");
    }

    return NextResponse.json({ tenants: tenants ?? [] });
  } catch {
    return serviceUnavailable();
  }
}

/** Enregistre un locataire. */
export async function POST(request: Request) {
  try {
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const parsed = tenantSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du locataire.");
    }

    const { data, error } = await context.supabase
      .from("tenants")
      .insert({
        organization_id: context.organizationId,
        full_name: parsed.data.fullName,
        phone: parsed.data.phone,
        whatsapp: parsed.data.whatsapp ?? null,
        email: parsed.data.email ?? null,
        id_document: parsed.data.idDocument ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select("id")
      .single();

    if (error || !data) {
      return databaseErrorResponse(error ?? {}, "Impossible d’enregistrer ce locataire.");
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch {
    return serviceUnavailable();
  }
}
