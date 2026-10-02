import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  DoorOpen,
  FileText,
  Home,
  MessageCircle,
  Phone,
} from "lucide-react";
import { InspectionForm } from "@/components/inspection-form";
import { LeaseInventory, type CatalogItem, type InventoryItem } from "@/components/lease-inventory";
import { getTypeLabel } from "@/lib/property-types";
import { formatDateFr, formatFCFA, paymentDayLabel } from "@/lib/lease-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInspectionTypeLabel } from "@/lib/inventory-types";

export const metadata: Metadata = { title: "Fiche du bail" };

/** Classe visuelle du statut d'une échéance. */
const STATUT_STYLE: Record<string, string> = {
  paid: "condition-success",
  pending: "condition-neutral",
  partial: "condition-warning",
  overdue: "condition-danger",
};

const STATUT_LABEL: Record<string, string> = {
  paid: "Payée",
  pending: "En attente",
  partial: "Partielle",
  overdue: "En retard",
};

export default async function LeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/login?next=${encodeURIComponent(`/leases/${id}`)}`);
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }
  const organizationId = membership.organization_id;

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select(
      "id, start_date, end_date, rent_amount, charges_amount, deposit_amount, payment_day, status, prorata_mode, prorata_basis, revision_rate, revision_allowed_at, unit:units ( id, label, unit_type_v2, category, property:properties ( id, name ) ), tenant:tenants ( id, full_name, phone, whatsapp )",
    )
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  // Un bail d une autre agence est indistinct d un bail inexistant : les deux
  // repondent 404, pour ne pas reveler l existence d un enregistrement tiers.
  if (leaseError || !lease) {
    notFound();
  }

  const bail = lease as unknown as {
    id: string;
    start_date: string;
    end_date: string | null;
    rent_amount: number;
    charges_amount: number;
    deposit_amount: number;
    payment_day: number;
    status: string;
    prorata_mode: string;
    prorata_basis: string;
    revision_rate: number;
    revision_allowed_at: string | null;
    unit: {
      id: string;
      label: string;
      unit_type_v2: string | null;
      category: string | null;
      property: { id: string; name: string } | null;
    } | null;
    tenant: { id: string; full_name: string; phone: string; whatsapp: string | null } | null;
  };

  const [echeancesResult, inventaireResult, catalogueResult, rapportsResult] = await Promise.all([
    supabase
      .from("rent_calls")
      .select(
        "id, period_year, period_month, due_date, rent_amount, charges_amount, total_amount, amount_paid, status",
      )
      .eq("lease_id", bail.id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false }),
    supabase
      .from("inventory_items")
      .select("id, name, category, quantity, condition, notes, photo_url, added_after_move_in")
      .eq("lease_id", bail.id)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("inventory_catalog")
      .select("id, category, name, default_quantity, organization_id")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("inspection_reports")
      .select("id, type, status, inspection_date")
      .eq("lease_id", bail.id)
      .order("inspection_date", { ascending: false }),
  ]);

  const echeances = (echeancesResult.data ?? []) as Array<{
    id: string;
    period_year: number;
    period_month: number;
    due_date: string;
    rent_amount: number;
    charges_amount: number;
    total_amount: number;
    amount_paid: number;
    status: string;
  }>;

  const inventaire = (inventaireResult.data ?? []) as unknown as InventoryItem[];
  const catalogue = (catalogueResult.data ?? []) as unknown as CatalogItem[];
  const rapports = (rapportsResult.data ?? []) as Array<{
    id: string;
    type: string;
    status: string;
    inspection_date: string;
  }>;

  const mensuel = Number(bail.rent_amount) + Number(bail.charges_amount);
  const attenduTotal = echeances.reduce((somme, ligne) => somme + Number(ligne.total_amount), 0);
  const encaisseTotal = echeances.reduce((somme, ligne) => somme + Number(ligne.amount_paid), 0);
  const enRetard = echeances.filter((ligne) => ligne.status === "overdue").length;
  const telephone = bail.tenant?.phone ?? "";
  const whatsapp = bail.tenant?.whatsapp ?? null;

  return (
    <main className="properties-page-shell">
      <div className="properties-page">
        <header className="properties-header">
          <div>
            <Link href="/leases" className="back-link">
              <ArrowLeft aria-hidden="true" />
              Retour aux locations
            </Link>
            <p className="dashboard-eyebrow">{bail.unit?.property?.name ?? "Bail"}</p>
            <h1>{bail.unit?.label ?? "Lot inconnu"}</h1>
          </div>
          <Link href="/dashboard" className="secondary-button">
            <Home size={16} aria-hidden="true" />
            Tableau de bord
          </Link>
        </header>

        <section className="properties-panel lease-identity">
          <div className="lease-identity-grid">
            <div>
              <p className="dashboard-eyebrow">Locataire</p>
              <strong className="lease-identity-name">
                {bail.tenant?.full_name ?? "Locataire supprimé"}
              </strong>
              <div className="tenant-actions">
                {telephone ? (
                  <a
                    className="icon-button"
                    href={`tel:${telephone}`}
                    aria-label={`Appeler ${bail.tenant?.full_name}`}
                  >
                    <Phone size={15} aria-hidden="true" />
                  </a>
                ) : null}
                {whatsapp ? (
                  <a
                    className="icon-button"
                    href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Écrire à ${bail.tenant?.full_name} sur WhatsApp`}
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                  </a>
                ) : null}
                <small className="lease-identity-phone">{telephone}</small>
              </div>
            </div>

            <div>
              <p className="dashboard-eyebrow">Type de bien</p>
              <strong>
                {bail.unit?.unit_type_v2 ? getTypeLabel(bail.unit.unit_type_v2) : "—"}
              </strong>
            </div>

            <div>
              <p className="dashboard-eyebrow">Période</p>
              <strong>
                {formatDateFr(bail.start_date)}
                {bail.end_date ? ` → ${formatDateFr(bail.end_date)}` : ""}
              </strong>
              <small className="lease-identity-foot">
                {paymentDayLabel(bail.payment_day)}
              </small>
            </div>

            <div>
              <p className="dashboard-eyebrow">Statut</p>
              <span
                className={`condition-chip ${
                  bail.status === "active" ? "condition-success" : "condition-neutral"
                }`}
              >
                {bail.status === "active" ? "Bail actif" : "Bail résilié"}
              </span>
              {bail.revision_allowed_at ? (
                <small className="lease-identity-foot">
                  Révision possible à partir du {formatDateFr(bail.revision_allowed_at)}
                  {Number(bail.revision_rate) > 0 ? ` · ${bail.revision_rate} %` : ""}
                </small>
              ) : null}
            </div>
          </div>

          <div className="lease-identity-money">
            <div>
              <span>Loyer</span>
              <strong>{formatFCFA(Number(bail.rent_amount))}</strong>
            </div>
            <div>
              <span>Charges</span>
              <strong>{formatFCFA(Number(bail.charges_amount))}</strong>
            </div>
            <div>
              <span>Total mensuel</span>
              <strong>{formatFCFA(mensuel)}</strong>
            </div>
            <div>
              <span>Dépôt</span>
              <strong>{formatFCFA(Number(bail.deposit_amount))}</strong>
            </div>
          </div>
        </section>

        <section className="properties-panel property-overview-panel">
          <div className="panel-header">
            <div>
              <p className="dashboard-eyebrow">Suivi</p>
              <h2>Échéances</h2>
            </div>
            {echeances.length > 0 ? (
              <span className="pill-badge">
                {echeances.length} échéance{echeances.length > 1 ? "s" : ""}
                {enRetard > 0 ? ` · ${enRetard} en retard` : ""}
              </span>
            ) : null}
          </div>

          {echeancesResult.error ? (
            <div className="empty-state empty-state-error">
              <CircleAlert size={22} aria-hidden="true" />
              <p>Impossible de charger les échéances de ce bail.</p>
            </div>
          ) : echeances.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <DoorOpen size={20} aria-hidden="true" />
              </div>
              <p>Aucune échéance enregistrée.</p>
              <span>
                La première échéance est créée à la signature du bail ; le calendrier
                mensuel prend le relais ensuite.
              </span>
            </div>
          ) : (
            <>
              <div className="lease-totals">
                <div>
                  <span>Attendu</span>
                  <strong>{formatFCFA(attenduTotal)}</strong>
                </div>
                <div>
                  <span>Encaissé</span>
                  <strong>{formatFCFA(encaisseTotal)}</strong>
                </div>
                <div>
                  <span>Reste à encaisser</span>
                  <strong>{formatFCFA(Math.max(0, attenduTotal - encaisseTotal))}</strong>
                </div>
              </div>
              <ul className="inventory-list">
                {echeances.map((ligne) => (
                  <li key={ligne.id} className="inventory-row">
                    <div className="inventory-row-main">
                      <strong>
                        {String(ligne.period_month).padStart(2, "0")}/{ligne.period_year}
                      </strong>
                      <small className="inventory-note">
                        Échéance le {formatDateFr(ligne.due_date)}
                      </small>
                    </div>
                    <div className="inventory-row-end">
                      <span
                        className={`condition-chip ${
                          STATUT_STYLE[ligne.status] ?? "condition-neutral"
                        }`}
                      >
                        {STATUT_LABEL[ligne.status] ?? ligne.status}
                      </span>
                      <strong className="unit-price">
                        {formatFCFA(Number(ligne.amount_paid))}
                        <span> / {formatFCFA(Number(ligne.total_amount))}</span>
                      </strong>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {rapports.length > 0 ? (
          <section className="properties-panel property-overview-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Historique</p>
                <h2>États des lieux réalisés</h2>
              </div>
            </div>
            <ul className="inventory-list">
              {rapports.map((rapport) => (
                <li key={rapport.id} className="inventory-row">
                  <div className="inventory-row-main">
                    <strong>
                      <FileText size={14} aria-hidden="true" />{" "}
                      {getInspectionTypeLabel(rapport.type)}
                    </strong>
                    <small className="inventory-note">
                      Réalisé le {formatDateFr(rapport.inspection_date)}
                    </small>
                  </div>
                  <div className="inventory-row-end">
                    <span
                      className={`condition-chip ${
                        rapport.status === "completed"
                          ? "condition-success"
                          : rapport.status === "disputed"
                            ? "condition-danger"
                            : "condition-warning"
                      }`}
                    >
                      {rapport.status === "completed"
                        ? "Signé"
                        : rapport.status === "disputed"
                          ? "Contesté"
                          : "En attente"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {inventaireResult.error ? (
          <div className="data-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <span>
              Impossible de charger l’inventaire de ce bail. Les autres sections restent
              consultables.
            </span>
          </div>
        ) : null}

        <LeaseInventory leaseId={bail.id} catalog={catalogue} items={inventaire} />

        <InspectionForm leaseId={bail.id} />
      </div>
    </main>
  );
}