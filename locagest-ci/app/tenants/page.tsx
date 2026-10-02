import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleAlert, Home, MessageCircle, Phone, Users } from "lucide-react";
import { TenantForm } from "@/components/tenant-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Locataires" };

interface TenantRow {
  id: string;
  full_name: string;
  phone: string;
  whatsapp: string | null;
  email: string | null;
  id_document: string | null;
  notes: string | null;
  created_at: string;
}

/** Retire les caracteres non numeriques, pour construire un lien wa.me valide. */
function lienWhatsapp(numero: string): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}`;
}

export default async function TenantsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=%2Ftenants");
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

  const { data, error } = await supabase
    .from("tenants")
    .select("id, full_name, phone, whatsapp, email, id_document, notes, created_at")
    .eq("organization_id", membership.organization_id)
    .order("full_name", { ascending: true });

  const tenants = (data ?? []) as TenantRow[];

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
            <h1>Locataires</h1>
          </div>
          <Link href="/dashboard" className="secondary-button">
            <Home size={16} aria-hidden="true" />
            Tableau de bord
          </Link>
        </header>

        {error ? (
          <div className="data-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <strong>La liste des locataires n’a pas pu être chargée.</strong>
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
                <h2>Ajouter un locataire</h2>
              </div>
              <span className="panel-step">01</span>
            </div>
            <p className="panel-description">
              Le téléphone est obligatoire : c’est par lui que les relances se font.
            </p>
            <TenantForm />
          </section>

          <section className="properties-panel property-overview-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Votre agence</p>
                <h2>Locataires enregistrés</h2>
              </div>
              {!error ? (
                <span className="pill-badge">
                  {tenants.length} locataire{tenants.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            {error ? (
              <div className="empty-state empty-state-error">
                <CircleAlert size={22} aria-hidden="true" />
                <p>Impossible d’afficher vos locataires pour le moment.</p>
              </div>
            ) : tenants.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Users size={20} aria-hidden="true" />
                </div>
                <p>Aucun locataire enregistré pour l’instant.</p>
                <span>
                  Ajoutez un locataire, puis associez-le à un lot vacant pour créer un
                  bail.
                </span>
              </div>
            ) : (
              <ul className="inventory-list">
                {tenants.map((tenant) => (
                  <li key={tenant.id} className="inventory-row">
                    <div className="inventory-row-main">
                      <strong>{tenant.full_name}</strong>
                      <small className="inventory-note">
                        {tenant.email ?? "Aucun e-mail"}
                        {tenant.id_document ? ` · ${tenant.id_document}` : ""}
                      </small>
                      {tenant.notes ? (
                        <small className="inventory-note">{tenant.notes}</small>
                      ) : null}
                    </div>
                    <div className="tenant-actions">
                      <a
                        className="icon-button"
                        href={`tel:${tenant.phone}`}
                        aria-label={`Appeler ${tenant.full_name}`}
                      >
                        <Phone size={15} aria-hidden="true" />
                      </a>
                      {tenant.whatsapp ? (
                        <a
                          className="icon-button"
                          href={lienWhatsapp(tenant.whatsapp)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Écrire à ${tenant.full_name} sur WhatsApp`}
                        >
                          <MessageCircle size={15} aria-hidden="true" />
                        </a>
                      ) : null}
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
