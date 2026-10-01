import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2, CircleAlert } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { PropertyForm, type PropertyOwner } from "@/components/property-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Biens et lots" };

export default async function PropertiesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login?next=%2Fproperties");
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

  const [propertiesResult, ownersResult] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, address, commune, owner_id, created_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("owners")
      .select("id, full_name, phone")
      .eq("organization_id", membership.organization_id)
      .order("full_name", { ascending: true }),
  ]);

  const properties = propertiesResult.data ?? [];
  const owners = (ownersResult.data ?? []) as PropertyOwner[];
  const propertyIds = properties.map((property) => property.id);
  const unitsResult = propertyIds.length
    ? await supabase
        .from("units")
        .select(
          "id, property_id, label, unit_type, unit_type_v2, category, surface_area, room_count, base_rent, charges, deposit_amount, floor, building_section, metadata, status",
        )
        .eq("organization_id", membership.organization_id)
        .in("property_id", propertyIds)
        .order("label", { ascending: true })
    : { data: [], error: null };

  const ownersById = new Map(owners.map((owner) => [owner.id, owner]));
  const propertiesWithUnits = (propertiesResult.error || ownersResult.error || unitsResult.error)
    ? []
    : properties.map((property) => ({
        ...property,
        owner: property.owner_id ? ownersById.get(property.owner_id) ?? null : null,
        units: (unitsResult.data ?? []).filter((unit) => unit.property_id === property.id),
      }));
  const hasLoadError = Boolean(propertiesResult.error || ownersResult.error || unitsResult.error);

  return (
    <main className="properties-page-shell">
      <div className="properties-page">
        <header className="properties-header">
          <div>
            <Link href="/dashboard" className="back-link">
              <ArrowLeft aria-hidden="true" />
              Retour au tableau de bord
            </Link>
            <p className="dashboard-eyebrow">Patrimoine</p>
            <h1>Biens et lots</h1>
            <p className="properties-intro">
              Centralisez les adresses, les propriétaires et les lots de votre agence.
            </p>
          </div>
          <Link href="/dashboard" className="secondary-button">
            <Building2 size={16} aria-hidden="true" />
            Tableau de bord
          </Link>
        </header>

        {hasLoadError ? (
          <div className="data-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div>
              <strong>Une partie du patrimoine n’a pas pu être chargée.</strong>
              <p>
                {propertiesResult.error
                  ? "La liste des biens est indisponible."
                  : ownersResult.error
                    ? "La liste des propriétaires est indisponible."
                    : "La liste des lots est indisponible."}{" "}
                Vos données ne sont pas remplacées par une liste vide. Actualisez la page pour réessayer.
              </p>
            </div>
          </div>
        ) : null}

        <div className="properties-grid">
          <section className="properties-panel property-create-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Nouvelle entrée</p>
                <h2>Ajouter un bien</h2>
              </div>
              <span className="panel-step">01</span>
            </div>
            <p className="panel-description">Les informations du propriétaire sont facultatives.</p>
            <PropertyForm owners={owners} />
          </section>

          <section className="properties-panel property-overview-panel">
            <div className="panel-header">
              <div>
                <p className="dashboard-eyebrow">Votre agence</p>
                <h2>Patrimoine enregistré</h2>
              </div>
              {!propertiesResult.error ? (
                <span className="pill-badge">
                  {properties.length} bien{properties.length > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>

            {propertiesResult.error ? (
              <div className="empty-state empty-state-error">
                <CircleAlert size={22} aria-hidden="true" />
                <p>Impossible d’afficher vos biens pour le moment.</p>
              </div>
            ) : ownersResult.error ? (
              <div className="empty-state empty-state-error">
                <CircleAlert size={22} aria-hidden="true" />
                <p>Impossible de vérifier les propriétaires liés à vos biens.</p>
              </div>
            ) : unitsResult.error ? (
              <div className="empty-state empty-state-error">
                <CircleAlert size={22} aria-hidden="true" />
                <p>Impossible d’afficher les lots de vos biens pour le moment.</p>
              </div>
            ) : properties.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Building2 size={20} aria-hidden="true" />
                </div>
                <p>Votre patrimoine est prêt à démarrer.</p>
                <span>Enregistrez un bien, puis ajoutez ses lots et leurs loyers.</span>
              </div>
            ) : (
              <div className="properties-list">
                {propertiesWithUnits.map((property) => (
                  <PropertyCard key={property.id} property={property} owners={owners} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
