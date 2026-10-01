import { NextResponse } from "next/server";
import { unitSchema } from "@/lib/validations/properties";
import { buildUnitPayload } from "@/lib/properties/unit-payload";
import {
  databaseErrorResponse,
  requireOrganization,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; unitId: string }> },
) {
  try {
    const { id: propertyId, unitId } = await params;
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const json = await request.json().catch(() => null);
    const parsed = unitSchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du lot.");
    }

    const { data: property, error: propertyError } = await context.supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (propertyError) {
      return databaseErrorResponse(propertyError, "Impossible de vérifier ce bien.");
    }
    if (!property) {
      return NextResponse.json({ error: "Ce bien est introuvable dans votre agence." }, { status: 404 });
    }

    const { data, error } = await context.supabase
      .from("units")
      .update({
        ...buildUnitPayload(parsed.data),
        unit_type_v2: parsed.data.unitType,
        category: parsed.data.category,
      })
      .eq("id", unitId)
      .eq("property_id", property.id)
      .eq("organization_id", context.organizationId)
      .select("id")
      .maybeSingle();

    if (error) {
      return databaseErrorResponse(error, "Impossible de modifier ce lot pour le moment.");
    }
    if (!data) {
      return NextResponse.json({ error: "Ce lot est introuvable dans ce bien." }, { status: 404 });
    }

    return NextResponse.json({ unit: data });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}
