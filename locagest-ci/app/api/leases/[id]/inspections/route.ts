import { NextResponse } from "next/server";
import {
  requireOrganization,
  leaseNotFound,
  readJson,
  resolveLease,
  serviceUnavailable,
} from "@/lib/leases/lease-context";
import {
  databaseErrorResponse,
  validationErrorResponse,
} from "@/lib/supabase/organization-context";
import { inspectionReportSchema } from "@/lib/validations/inventory";

/**
 * États des lieux d'un bail.
 *
 * Le rapport et ses points de contrôle sont écrits en deux temps : le rapport
 * d'abord, puis ses lignes. Si l'insertion des lignes échoue, le rapport est
 * conservé et l'API le signale par un avertissement : un état des lieux à moitié
 * saisi vaut mieux qu'un état des lieux perdu, et l'agent peut le compléter.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;
    const context = await requireOrganization(false);
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

    const { data: reports, error } = await context.supabase
      .from("inspection_reports")
      .select(
        "id, type, status, inspection_date, tenant_present, water_meter_index, electricity_meter_index, general_notes, tenant_signature_url, landlord_signature_url, pdf_url, created_at",
      )
      .eq("organization_id", context.organizationId)
      .eq("lease_id", lease.id)
      .order("inspection_date", { ascending: false });

    if (error) {
      return databaseErrorResponse(error, "Impossible de charger les états des lieux.");
    }

    return NextResponse.json({ reports: reports ?? [] });
  } catch {
    return serviceUnavailable();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: leaseId } = await params;
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const parsed = inspectionReportSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return validationErrorResponse(
        parsed.error,
        "Vérifiez les informations de l’état des lieux.",
      );
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

    const { data: report, error: reportError } = await context.supabase
      .from("inspection_reports")
      .insert({
        organization_id: context.organizationId,
        lease_id: lease.id,
        type: parsed.data.type,
        inspection_date: parsed.data.inspectionDate || new Date().toISOString().slice(0, 10),
        tenant_present: parsed.data.tenantPresent ?? false,
        water_meter_index: parsed.data.waterMeterIndex ?? null,
        electricity_meter_index: parsed.data.electricityMeterIndex ?? null,
        general_notes: parsed.data.generalNotes ?? null,
        conducted_by: userData?.user?.id ?? null,
      })
      .select("id")
      .single();

    if (reportError || !report) {
      return databaseErrorResponse(
        reportError ?? { code: undefined },
        "Impossible de créer cet état des lieux.",
      );
    }

    const lignes = parsed.data.items.map((item, index) => ({
      report_id: report.id,
      organization_id: context.organizationId,
      room: item.room,
      element: item.element,
      condition: item.condition,
      notes: item.notes ?? null,
      photo_url: item.photoUrl ?? null,
      sort_order: item.sortOrder ?? index,
    }));

    if (lignes.length > 0) {
      const { error: itemsError } = await context.supabase
        .from("inspection_items")
        .insert(lignes);

      if (itemsError) {
        return NextResponse.json(
          {
            id: report.id,
            warning:
              "L’état des lieux a été créé, mais ses points de contrôle n’ont pas pu être enregistrés. Vous pouvez les compléter.",
          },
          { status: 201 },
        );
      }
    }

    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch {
    return serviceUnavailable();
  }
}
