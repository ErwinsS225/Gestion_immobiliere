import { NextResponse } from "next/server";
import { propertySchema } from "@/lib/validations/properties";
import { removeNewOwner, resolveOwner } from "@/lib/properties/owner";
import {
  databaseErrorResponse,
  requireOrganization,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";

export async function GET() {
  try {
    const context = await requireOrganization();
    if (context.response) return context.response;

    const [propertiesResult, ownersResult] = await Promise.all([
      context.supabase
        .from("properties")
        .select("id, name, address, commune, owner_id, created_at")
        .eq("organization_id", context.organizationId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("owners")
        .select("id, full_name")
        .eq("organization_id", context.organizationId)
        .order("full_name", { ascending: true }),
    ]);

    if (propertiesResult.error) {
      return databaseErrorResponse(propertiesResult.error, "Impossible de charger les biens de l’agence.");
    }
    if (ownersResult.error) {
      return databaseErrorResponse(ownersResult.error, "Impossible de charger les propriétaires de l’agence.");
    }

    const properties = propertiesResult.data ?? [];
    const propertyIds = properties.map((property) => property.id);
    const { data: units, error: unitsError } = propertyIds.length
      ? await context.supabase
          .from("units")
          .select("id, property_id, label, unit_type, surface_area, room_count, base_rent, charges, status")
          .eq("organization_id", context.organizationId)
          .in("property_id", propertyIds)
          .order("label", { ascending: true })
      : { data: [], error: null };

    if (unitsError) {
      return databaseErrorResponse(unitsError, "Impossible de charger les lots de l’agence.");
    }

    const ownersById = new Map((ownersResult.data ?? []).map((owner) => [owner.id, owner]));
    return NextResponse.json({
      properties: properties.map((property) => ({
        ...property,
        owner: property.owner_id ? ownersById.get(property.owner_id) ?? null : null,
        units: (units ?? []).filter((unit) => unit.property_id === property.id),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const json = await request.json().catch(() => null);
    const parsed = propertySchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du bien.");
    }

    const owner = await resolveOwner(context.supabase, context.organizationId, parsed.data);
    if ("error" in owner && owner.error) {
      return databaseErrorResponse(owner.error, "Impossible d’enregistrer le propriétaire.");
    }
    if ("missingOwner" in owner && owner.missingOwner) {
      return NextResponse.json(
        { error: "Ce propriétaire n’existe pas dans l’agence. Actualisez la page et réessayez." },
        { status: 422 },
      );
    }

    const { data, error } = await context.supabase
      .from("properties")
      .insert({
        organization_id: context.organizationId,
        name: parsed.data.name,
        address: parsed.data.address,
        commune: parsed.data.commune,
        owner_id: owner.ownerId,
      })
      .select("id")
      .single();

    if (error) {
      const rollbackSucceeded = await removeNewOwner(
        context.supabase,
        context.organizationId,
        owner.createdOwnerId,
      );
      if (!rollbackSucceeded) {
        return NextResponse.json(
          { error: "Le bien n’a pas été enregistré. Le propriétaire a été conservé dans l’agence ; vous pouvez le sélectionner et réessayer." },
          { status: 500 },
        );
      }
      return databaseErrorResponse(error, "Impossible de créer ce bien pour le moment.");
    }

    return NextResponse.json({ property: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}
