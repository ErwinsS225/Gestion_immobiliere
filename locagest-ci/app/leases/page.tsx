import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleAlert, DoorOpen, Home } from "lucide-react";
import { LeaseForm, type LeaseTenantOption } from "@/components/lease-form";
import { formatDateFr, formatFCFA } from "@/lib/lease-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Locations" };

// Supabase type les relations imbriquées comme des tableaux, alors que la
// jointure renvoyée par PostgREST est un objet unique ou null. Les types réels
// sont donc repris ici, et la conversion se fait via unknown, sans quoi
// TypeScript signale un conflit sur des formes pourtant compatibles.
interface NestedUnit {
  id: string;
  label: string;
  category: string | null;
  property: { id: string; name: string } | null;
}

interface NestedTenant {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
}

interface LeaseRow {
  id: string;
  start_date: string;
  end_date: string | null;
  rent_amount: number;
  charges_amount: number;
  deposit_amount: number;
  payment_day: number;
  status: string;
  unit: NestedUnit | null;
  tenant: NestedTenant | null;
}

interface UnitRow {
  id: string;
  label: string;
  category: string | null;
  base_rent: number;
  charges: number;
  property: { id: string; name: string } | null;
}

export default async function LeasesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=%2Fleases");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return (
      <main className="properties-page-shell">
        <div className="properties-page">
          <div className="data-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>Impossible de vérifier l’accès à votre agence. Actualisez la page ou contactez le support.</span>
          </div>
        </div>
      </main>
    );
  }
  if (!membership) {
    redirect("/onboarding");
  }

  const organizationId = membership.organization_id;

  const [leasesResult, lotsResult, tenantsResult] = await Promise.all([
    supabase
      .from("leases")
      .select(
        "id, start_date, end_date, rent_amount, charges_amount, deposit_amount, payment_day, status, unit:units ( id, label, category, property:properties ( id, name ) ), tenant:tenants ( id, full_name, phone, whatsapp )",
      )
      .eq("organization_id", organizationId)
      .order("start_date", { ascending: false }),
    supabase
      .from("units")
      .select("id, label, category, base_rent, charges, property:properties ( id, name )")
      .eq("organization_id", organizationId)
      .eq("status", "vacant")
      .order("label", { ascending: true }),
    supabase
      .from("tenants")
      .select("id, full_name, phone, whatsapp")
      .eq("organization_id", organizationId)
      .order("full_name", { ascending: true }),
  ]);

  const leases = (leasesResult.data ?? []) as unknown as LeaseRow[];
  const units = (lotsResult.data ?? []) as unknown as UnitRow[];
  const tenants = (tenantsResult.data ?? []) as unknown as LeaseTenantOption[];
  const hasLoadError = Boolean(leasesResult.error || lotsResult.error || tenantsResult.error);

  return (
    <main className="properties-page-shell">
      <div className="properties-page">
        <header className="properties-header">
          <div>
            <Link href="/dashboard" className="back-link">
              <ArrowLeft aria-hidden="true" />
              Retour au tableau de bord
            </Link>
            <p className="dashboard-eyebrow">Locations</p>
            <h1>Baux</h1>
          </div>
          <Link href="/dashboard" className="secondary-button">
            <Home size={16} aria-hidden="true" />
            Tableau de bord
          </Link>
        </header>

        {hasLoadError ? (
          <div className="data-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <strong>Une partie des locations n’a pas pu être chargée.</strong>
              <p>
                Vos données ne sont pas remplacées par une liste vide. Actualisez la page
                pour réessayer.
              </p>
            </div>
          </div>
        ) : null}

        <div className="properties-grid">
          <section className="properties-panel property-create-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Nouvelle entrée</p>
                <h2>Signer un bail</h2>
              </div>
              <span className="panel-step">01</span>
            </div>
            <p className="panel-description">
              Un lot vacant, un locataire enregistré, et les conditions.
            </p>
            <LeaseForm units={units} tenants={tenants} />
          </section>

          <section className="properties-panel property-overview-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Votre agence</p>
                <h2>Baux signés</h2>
              </div>
              {!leasesResult.error ? (
                <span className="pill-badge">
                  {leases.length} bail{leases.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            {leasesResult.error ? (
              <div className="empty-state empty-state-error">
                <CircleAlert size={22} aria-hidden="true" />
                <p>Impossible d’afficher vos baux pour le moment.</p>
              </div>
            ) : leases.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <DoorOpen size={20} aria-hidden="true" />
                </div>
                <p>Aucun bail signé pour l’instant.</p>
                <span>
                  Associez un lot vacant à un locataire : la première échéance est créée
                  immédiatement.
                </span>
              </div>
            ) : (
              <ul className="inventory-list">
                {leases.map((lease) => (
                  <li key={lease.id} className="inventory-row">
                    <div className="inventory-row-main">
                      <strong>
                        {lease.unit?.property?.name
                          ? `${lease.unit.property.name} — `
                          : ""}
                        {lease.unit?.label ?? "Lot supprimé"}
                      </strong>
                      <small className="inventory-note">
                        {lease.tenant?.full_name ?? "Locataire supprimé"}
                        {lease.tenant?.phone ? ` · ${lease.tenant.phone}` : ""}
                      </small>
                      <small className="inventory-note">
                        Depuis le {formatDateFr(lease.start_date)}
                        {lease.end_date ? ` au ${formatDateFr(lease.end_date)}` : ""} ·
                        échéance le {lease.payment_day}
                      </small>
                    </div>
                    <div className="inventory-row-end">
                      <span
                        className={`condition-chip ${
                          lease.status === "active" ? "condition-success" : "condition-neutral"
                        }`}
                      >
                        {lease.status === "active" ? "Actif" : "Résilié"}
                      </span>
                      <strong className="unit-price">
                        {formatFCFA(Number(lease.rent_amount) + Number(lease.charges_amount))}
                        <span> / mois</span>
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}