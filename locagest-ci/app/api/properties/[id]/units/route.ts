import { NextResponse } from "next/server";
import { unitSchema } from "@/lib/validations/properties";
import {
  databaseErrorResponse,
  requireOrganization,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";

async function findProperty(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createSupabaseServerClient>>,
  id: string,
  organizationId: string,
) {
  return supabase
    .from("properties")
    .select("id")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireOrganization();
    if (context.response) return context.response;

    const { data: property, error: propertyError } = await findProperty(
      context.supabase,
      id,
      context.organizationId,
    );
    if (propertyError) {
      return databaseErrorResponse(propertyError, "Impossible de vérifier ce bien.");
    }
    if (!property) {
      return NextResponse.json({ error: "Ce bien est introuvable dans votre agence." }, { status: 404 });
    }

    const { data: units, error } = await context.supabase
      .from("units")
      .select("id, label, unit_type, surface_area, room_count, base_rent, charges, status")
      .eq("organization_id", context.organizationId)
      .eq("property_id", property.id)
      .order("label", { ascending: true });
    if (error) {
      return databaseErrorResponse(error, "Impossible de charger les lots.");
    }

    return NextResponse.json({ units: units ?? [] });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const json = await request.json().catch(() => null);
    const parsed = unitSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du lot.");
    }

    const { data: property, error: propertyError } = await findProperty(
      context.supabase,
      id,
      context.organizationId,
    );
    if (propertyError) {
      return databaseErrorResponse(propertyError, "Impossible de vérifier ce bien.");
    }
    if (!property) {
      return NextResponse.json({ error: "Ce bien est introuvable dans votre agence." }, { status: 404 });
    }

    const { data, error } = await context.supabase
      .from("units")
      .insert({
        organization_id: context.organizationId,
        property_id: property.id,
        label: parsed.data.label,
        unit_type: parsed.data.unitType,
        surface_area: parsed.data.surfaceArea,
        room_count: parsed.data.roomCount,
        base_rent: parsed.data.baseRent,
        charges: parsed.data.charges,
        status: "vacant",
      })
      .select("id")
      .single();

    if (error) {
      return databaseErrorResponse(error, "Impossible de créer ce lot pour le moment.");
    }

    return NextResponse.json({ unit: data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}
