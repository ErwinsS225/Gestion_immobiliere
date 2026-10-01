import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
    Bell,
    Building2,
    Check,
    ClipboardList,
    DoorOpen,
    House,
    LayoutDashboard,
    MapPin,
    Plus,
    Users,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vue d’ensemble" };

const onboardingSteps = [
    { label: "Créer une propriété", icon: House },
    { label: "Ajouter un lot", icon: DoorOpen },
    { label: "Enregistrer un locataire", icon: Users },
    { label: "Créer un bail", icon: ClipboardList },
];

function getTrialLabel(trialEndsAt: string | null) {
    if (!trialEndsAt) return "Essai gratuit";

    const endTime = new Date(trialEndsAt).getTime();
    if (Number.isNaN(endTime)) return "Essai gratuit";

    const remainingDays = Math.max(0, Math.ceil((endTime - Date.now()) / 86_400_000));
    if (remainingDays === 0) return "Essai arrivé à échéance";

    return `Essai gratuit · ${remainingDays} jour${remainingDays > 1 ? "s" : ""} restant${remainingDays > 1 ? "s" : ""}`;
}

export default async function DashboardPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?next=%2Fdashboard");
    }

    const { data: membership, error: membershipError } = await supabase
        .from("memberships")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

    if (membershipError || !membership) {
        redirect("/onboarding");
    }

    const { data: organization, error: organizationError } = await supabase
        .from("organizations")
        .select("name, city, trial_ends_at")
        .eq("id", membership.organization_id)
        .maybeSingle();

    if (organizationError || !organization) {
        redirect("/onboarding");
    }

    const [propertiesResult, unitsResult, occupiedUnitsResult, tenantsResult, activeLeasesResult] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
        supabase.from("units").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id).eq("status", "occupied"),
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id),
        supabase.from("leases").select("id", { count: "exact", head: true }).eq("organization_id", membership.organization_id).eq("status", "active"),
    ]);

    const dashboardDataError = [
        propertiesResult.error,
        unitsResult.error,
        occupiedUnitsResult.error,
        tenantsResult.error,
        activeLeasesResult.error,
    ].some(Boolean);
    const propertiesCount = Number(propertiesResult.count ?? 0);
    const unitsCount = Number(unitsResult.count ?? 0);
    const occupiedUnitsCount = Number(occupiedUnitsResult.count ?? 0);
    const tenantsCount = Number(tenantsResult.count ?? 0);
    const activeLeasesCount = Number(activeLeasesResult.count ?? 0);

    const occupancyRate = unitsCount > 0 ? Math.round((occupiedUnitsCount / unitsCount) * 100) : 0;
    const completedSteps = [
        !propertiesResult.error && propertiesCount > 0,
        !unitsResult.error && unitsCount > 0,
        !tenantsResult.error && tenantsCount > 0,
        !activeLeasesResult.error && activeLeasesCount > 0,
    ].filter(Boolean).length;

    const dashboardMetrics = [
        {
            label: "Biens",
            value: propertiesResult.error ? "—" : propertiesCount,
            icon: House,
            note: "Propriétés enregistrées dans l’agence",
        },
        {
            label: "Lots",
            value: unitsResult.error ? "—" : unitsCount,
            icon: DoorOpen,
            note: "Unités immobilières gérées",
        },
        {
            label: "Baux actifs",
            value: activeLeasesResult.error ? "—" : activeLeasesCount,
            icon: ClipboardList,
            note: "Contrats en cours",
        },
        {
            label: "Occupation",
            value: unitsResult.error || occupiedUnitsResult.error ? "—" : `${occupancyRate}%`,
            icon: Building2,
            note: "Taux d’occupation estimé",
        },
    ];

    const fullName = user.user_metadata?.full_name;
    const firstName = typeof fullName === "string" ? fullName.trim().split(/\s+/)[0] : "";
    const currentDate = new Intl.DateTimeFormat("fr-CI", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Africa/Abidjan",
    }).format(new Date());

    return (
        <div className="dashboard-app">
            <aside className="dashboard-sidebar">
                <a className="dashboard-brand" href="/dashboard" aria-label="Locagest CI, accueil">
                    <span className="dashboard-brand-mark" aria-hidden="true">
                        <Building2 size={20} strokeWidth={2.4} />
                    </span>
                    <span className="dashboard-brand-name">
                        Locagest <em>CI</em>
                    </span>
                </a>

                <div className="dashboard-agency">
                    <span className="dashboard-agency-mark" aria-hidden="true">
                        {organization.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="dashboard-agency-copy">
                        <strong>{organization.name}</strong>
                        <small>{organization.city || "Côte d’Ivoire"}</small>
                    </span>
                </div>

                <p className="dashboard-nav-label">Espace agence</p>
                <nav className="dashboard-nav" aria-label="Navigation principale">
                    <a className="dashboard-nav-item active" href="/dashboard" aria-current="page">
                        <LayoutDashboard size={17} aria-hidden="true" />
                        <span>Vue d’ensemble</span>
                    </a>
                    <Link className="dashboard-nav-item" href="/properties">
                        <House size={17} aria-hidden="true" />
                        <span>Biens</span>
                    </Link>
                    {[
                        { label: "Locations", icon: DoorOpen },
                        { label: "Locataires", icon: Users },
                    ].map(({ label, icon: Icon }) => (
                        <span className="dashboard-nav-item disabled" aria-disabled="true" key={label}>
                            <Icon size={17} aria-hidden="true" />
                            <span>{label}</span>
                            <small>Bientôt</small>
                        </span>
                    ))}
                </nav>

                <div className="dashboard-sidebar-bottom">
                    <span className="dashboard-trial-dot" aria-hidden="true" />
                    <span>{getTrialLabel(organization.trial_ends_at)}</span>
                </div>
            </aside>

            <main className="dashboard-main">
                <header className="dashboard-topbar">
                    <div className="dashboard-mobile-brand">
                        <span className="dashboard-brand-mark" aria-hidden="true">
                            <Building2 size={18} strokeWidth={2.4} />
                        </span>
                        <span className="dashboard-brand-name">
                            Locagest <em>CI</em>
                        </span>
                    </div>
                    <span className="dashboard-date">{currentDate}</span>
                    <span className="dashboard-user-mark" aria-label={firstName || "Gestionnaire"}>
                        {firstName.slice(0, 1).toUpperCase() || "G"}
                    </span>
                </header>

                <div className="dashboard-content">
                    <section className="dashboard-heading">
                        <div>
                            <p className="dashboard-eyebrow">{organization.name}</p>
                            <h1>{firstName ? `Bonjour ${firstName}` : "Vue d’ensemble"}</h1>
                            <p className="dashboard-subtitle">
                                Votre activité locative, en un seul endroit.
                            </p>
                        </div>
                        <div className="dashboard-heading-actions">
                            <span className="dashboard-trial-badge">
                                <span className="dashboard-trial-dot" aria-hidden="true" />
                                {getTrialLabel(organization.trial_ends_at)}
                            </span>
                            <Link className="primary-button compact-button" href="/properties">
                                <Plus size={15} aria-hidden="true" />
                                Ajouter un bien
                            </Link>
                        </div>
                    </section>

                    <section className="dashboard-metrics" aria-label="Indicateurs locatifs">
                        {dashboardMetrics.map(({ label, value, icon: Icon, note }) => (
                            <article className="dashboard-metric" key={label}>
                                <div className="dashboard-metric-top">
                                    <span>{label}</span>
                                    <span className="dashboard-metric-icon" aria-hidden="true">
                                        <Icon size={17} />
                                    </span>
                                </div>
                                <strong className="dashboard-metric-value">{value}</strong>
                                <span className="dashboard-metric-note">{note}</span>
                            </article>
                        ))}
                    </section>

                    {dashboardDataError ? (
                        <p className="data-error" role="alert">
                            Certaines données du patrimoine n’ont pas pu être actualisées. Vérifiez les migrations et l’accès Supabase, puis rechargez la page.
                        </p>
                    ) : null}

                    <section className="dashboard-lower-grid">
                        <article className="dashboard-panel dashboard-checklist-panel">
                            <div className="dashboard-panel-heading">
                                <div>
                                    <p className="dashboard-eyebrow">Mise en place</p>
                                    <h2>Les premières étapes</h2>
                                </div>
                                <span className="dashboard-step-count">{completedSteps} / 4</span>
                            </div>
                            <ol className="dashboard-checklist">
                                {onboardingSteps.map(({ label, icon: Icon }, index) => {
                                    const stepComplete = [
                                        !propertiesResult.error && propertiesCount > 0,
                                        !unitsResult.error && unitsCount > 0,
                                        !tenantsResult.error && tenantsCount > 0,
                                        !activeLeasesResult.error && activeLeasesCount > 0,
                                    ][index];

                                    return (
                                        <li className="dashboard-checklist-row" key={label}>
                                            <span className="dashboard-step-number">{index + 1}</span>
                                            <Icon size={18} aria-hidden="true" />
                                            <span className="dashboard-checklist-label">{label}</span>
                                            <span className="dashboard-todo">{stepComplete ? "OK" : "À faire"}</span>
                                        </li>
                                    );
                                })}
                            </ol>
                        </article>

                        <article className="dashboard-panel dashboard-alert-panel">
                            <div className="dashboard-panel-heading">
                                <div>
                                    <p className="dashboard-eyebrow">À surveiller</p>
                                    <h2>Alertes</h2>
                                </div>
                                <Bell size={18} aria-hidden="true" />
                            </div>
                            <div className="dashboard-empty-alert">
                                <span className="dashboard-empty-icon" aria-hidden="true">
                                    <Check size={19} />
                                </span>
                                <p>Les alertes apparaîtront avec vos premières échéances.</p>
                            </div>
                        </article>
                    </section>

                    <p className="dashboard-location-note">
                        <MapPin size={14} aria-hidden="true" />
                        Données de l’agence hébergées dans votre espace sécurisé.
                    </p>
                </div>
            </main>
        </div>
    );
}