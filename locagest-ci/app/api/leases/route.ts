import { NextResponse } from "next/server";
import {
  databaseErrorResponse,
  findOccupiedLease,
  readJson,
  requireOrganization,
  serviceUnavailable,
  tenantNotFound,
  unitNotAvailable,
  unitNotFound,
} from "@/lib/leases/lease-context";
import { validationErrorResponse } from "@/lib/supabase/organization-context";
import { leaseFormSchema } from "@/lib/validations/lease";
import { computeMoveInBreakdown } from "@/lib/lease-utils";

/**
 * Liste des baux de l agence, avec le lot et le locataire associes.
 *
 * Les lots vacants sont renvoyes a part : l agent doit pouvoir alimenter le
 * selecteur de lot avec les seuls lots disponibles, sans refaire de requete.
 */
export async function GET(request: Request) {
  try {
    const context = await requireOrganization(false);
    if (context.response) return context.response;

    const url = new URL(request.url);
    const statut = url.searchParams.get("statut");

    let requete = context.supabase
      .from("leases")
      .select(
        "id, start_date, end_date, rent_amount, charges_amount, deposit_amount, payment_day, status, prorata_mode, prorata_basis, revision_rate, revision_allowed_at, created_at, unit:units ( id, label, category, property:properties ( id, name ) ), tenant:tenants ( id, full_name, phone, whatsapp )",
      )
      .eq("organization_id", context.organizationId)
      .order("start_date", { ascending: false });

    if (statut === "active" || statut === "terminated") {
      requete = requete.eq("status", statut);
    }

    const { data: leases, error } = await requete;
    if (error) {
      return databaseErrorResponse(error, "Impossible de charger les baux.");
    }

    const { data: lotsLibres, error: lotsError } = await context.supabase
      .from("units")
      .select("id, label, category, base_rent, charges, property:properties ( id, name )")
      .eq("organization_id", context.organizationId)
      .eq("status", "vacant")
      .order("label", { ascending: true });

    if (lotsError) {
      return databaseErrorResponse(lotsError, "Impossible de charger les lots disponibles.");
    }

    return NextResponse.json({ leases: leases ?? [], lotsDisponibles: lotsLibres ?? [] });
  } catch {
    return serviceUnavailable();
  }
}

/**
 * Creation d un bail.
 *
 * Le lot et le locataire sont relus en base et scopes a l organisation : ils ne
 * sont jamais acceptes tels quels depuis le client. Un bail actif sur le lot est
 * refuse avant l ecriture, pour renvoyer un message exploitable.
 */
export async function POST(request: Request) {
  try {
    const context = await requireOrganization(true);
    if (context.response) return context.response;

    const parsed = leaseFormSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, "Vérifiez les conditions du bail.");
    }

    const { unitId, tenantId } = parsed.data;

    const [{ data: unit, error: unitError }, { data: tenant, error: tenantError }] =
      await Promise.all([
        context.supabase
          .from("units")
          .select("id, status")
          .eq("id", unitId)
          .eq("organization_id", context.organizationId)
          .maybeSingle(),
        context.supabase
          .from("tenants")
          .select("id")
          .eq("id", tenantId)
          .eq("organization_id", context.organizationId)
          .maybeSingle(),
      ]);

    if (unitError) {
      return databaseErrorResponse(unitError, "Impossible de vérifier ce lot.");
    }
    if (tenantError) {
      return databaseErrorResponse(tenantError, "Impossible de vérifier ce locataire.");
    }
    if (!unit) return unitNotFound();
    if (!tenant) return tenantNotFound();

    // Un lot deja couvert par un bail actif ne peut pas en recevoir un second.
    const occupe = await findOccupiedLease(context.supabase, unitId, context.organizationId);
    if (occupe) return unitNotAvailable();

    const { data: lease, error: insertError } = await context.supabase
      .from("leases")
      .insert({
        organization_id: context.organizationId,
        unit_id: unitId,
        tenant_id: tenantId,
        start_date: parsed.data.startDate,
        end_date: parsed.data.endDate,
        rent_amount: parsed.data.rentAmount,
        charges_amount: parsed.data.chargesAmount,
        deposit_amount: parsed.data.depositAmount,
        payment_day: parsed.data.paymentDay,
        prorata_mode: parsed.data.prorataMode,
        prorata_basis: parsed.data.prorataBasis,
        revision_rate: parsed.data.revisionRate,
        status: "active",
      })
      .select("id, revision_allowed_at")
      .single();

    if (insertError || !lease) {
      return databaseErrorResponse(insertError ?? {}, "Impossible de créer le bail.");
    }

    // Le lot passe en occupe : la colonne status est un cache de lecture, la
    // source de verite restant l existence d un bail actif.
    await context.supabase
      .from("units")
      .update({ status: "occupied" })
      .eq("id", unitId)
      .eq("organization_id", context.organizationId);

    // Premiere echeance creee immediatement, avec les montants proratises. Le cron
    // mensuel ne la recreera pas : la contrainte d unicite le garantit.
    const [annee, mois] = parsed.data.startDate.split("-").map(Number);
    const jour = String(parsed.data.paymentDay).padStart(2, "0");
    const dueDate = `${annee}-${String(mois).padStart(2, "0")}-${jour}`;

    // Le prorata est applique separement au loyer et aux charges ; l echeance
    // conserve cette repartition pour que le detail reste comparable aux mois
    // suivants.
    const recap = computeMoveInBreakdown(
      parsed.data.rentAmount,
      parsed.data.chargesAmount,
      parsed.data.depositAmount,
      parsed.data.startDate,
      parsed.data.prorataMode,
      parsed.data.prorataBasis,
    );

    const { error: echeanceError } = await context.supabase.from("rent_calls").insert({
      organization_id: context.organizationId,
      lease_id: lease.id,
      period_year: annee,
      period_month: mois,
      due_date: dueDate,
      rent_amount: recap.rentPart,
      charges_amount: recap.chargesPart,
    });

    if (echeanceError) {
      return NextResponse.json(
        {
          id: lease.id,
          warning:
            "Le bail a été créé, mais la première échéance n’a pas pu être enregistrée. Ajoutez-la depuis la fiche du bail.",
        },
        { status: 201 },
      );
    }

    return NextResponse.json({ id: lease.id }, { status: 201 });
  } catch {
    return serviceUnavailable();
  }
}
