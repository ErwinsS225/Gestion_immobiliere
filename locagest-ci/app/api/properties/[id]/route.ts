import { NextResponse } from "next/server";
import { propertySchema } from "@/lib/validations/properties";
import {
  databaseErrorResponse,
  requireOrganization,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";
import { removeNewOwner, resolveOwner } from "@/lib/properties/owner";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const json = await request.json().catch(() => null);
    const parsed = propertySchema.safeParse(json);
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les informations du bien.");
    }

    const { data: existing, error: existingError } = await context.supabase
      .from("properties")
      .select("id")
      .eq("id", id)
      .eq("organization_id", context.organizationId)
      .maybeSingle();
    if (existingError) {
      return databaseErrorResponse(existingError, "Impossible de vérifier ce bien.");
    }
    if (!existing) {
      return NextResponse.json({ error: "Ce bien est introuvable dans votre agence." }, { status: 404 });
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
      .update({
        name: parsed.data.name,
        address: parsed.data.address,
        commune: parsed.data.commune,
        owner_id: owner.ownerId,
      })
      .eq("id", existing.id)
      .eq("organization_id", context.organizationId)
      .select("id, owner_id")
      .maybeSingle();

    if (error || !data) {
      const rollbackSucceeded = await removeNewOwner(
        context.supabase,
        context.organizationId,
        owner.createdOwnerId,
      );
      if (!rollbackSucceeded) {
        return NextResponse.json(
          { error: "Le bien n’a pas été modifié. Le propriétaire a été conservé dans l’agence ; vous pouvez le sélectionner et réessayer." },
          { status: 500 },
        );
      }
      if (error) return databaseErrorResponse(error, "Impossible de modifier ce bien pour le moment.");
      return NextResponse.json({ error: "Ce bien ne peut pas être modifié dans votre agence." }, { status: 403 });
    }

    return NextResponse.json({ property: data });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}
