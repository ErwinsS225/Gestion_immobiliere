import { NextResponse } from "next/server";
import {
  leaseContext,
  leaseNotFound,
  readJson,
  resolveLease,
  serviceUnavailable,
} from "@/lib/leases/lease-context";
import {
  databaseErrorResponse,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";
import { inventoryItemRefined } from "@/lib/validations/inventory";

/**
 * Inventaire du mobilier d'un bail.
 *
 * Lecture : la liste des objets, avec le catalogue de reference. Le catalogue
 * systeme est visible par toutes les agences, le catalogue propre a une seule.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;
    const context = await leaseContext(false);
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

    const [itemsResult, catalogResult] = await Promise.all([
      context.supabase
        .from("inventory_items")
        .select(
          "id, name, category, quantity, condition, notes, photo_url, added_after_move_in, created_at",
        )
        .eq("organization_id", context.organizationId)
        .eq("lease_id", lease.id)
        .order("category", { ascending: true })
        .order("name", { ascending: true }),
      context.supabase
        .from("inventory_catalog")
        .select("id, category, name, default_quantity")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (itemsResult.error) {
      return databaseErrorResponse(itemsResult.error, "Impossible de charger l’inventaire.");
    }
    if (catalogResult.error) {
      return databaseErrorResponse(catalogResult.error, "Impossible de charger le catalogue.");
    }

    return NextResponse.json({
      items: itemsResult.data ?? [],
      // Le catalogue systeme porte organization_id null : PostgREST le renvoie
      // tel quel, le filtre se fait cote client pour regrouper par piece.
      catalog: catalogResult.data ?? [],
    });
  } catch {
    return serviceUnavailable();
  }
}

/** Ajoute un objet a l'inventaire du bail. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;
    const context = await leaseContext(true);
    if (context.response) return context.response;

    const parsed = inventoryItemRefined.safeParse(await readJson(request));
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations de l’objet.");
    }

    const { data: lease, error: leaseError } = await resolveLease(
      context.supabase,
      leaseId,
      context.organizationId,
    );
    if (leaseError) {
      return databaseErrorResponse(leaseError, "Impossible de vérifier ce bail.");
    }
    if (!lease) return leaseNotFound();

    const { data: userData } = await context.supabase.auth.getUser();

    const { data, error } = await context.supabase
      .from("inventory_items")
      .insert({
        organization_id: context.organizationId,
        lease_id: lease.id,
        catalog_id: parsed.data.catalogId ?? null,
        name: parsed.data.name,
        category: parsed.data.category ?? null,
        quantity: parsed.data.quantity,
        condition: parsed.data.condition,
        notes: parsed.data.notes ?? null,
        photo_url: parsed.data.photoUrl ?? null,
        added_after_move_in: parsed.data.addedAfterMoveIn ?? false,
        created_by: userData?.user?.id ?? null,
      })
      .select("id")
      .single();

    if (error) {
      return databaseErrorResponse(error, "Impossible d’enregistrer cet objet.");
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch {
    return serviceUnavailable();
  }
}
