import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { OnboardingForm } from "@/components/onboarding-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Créer votre agence" };

export default async function OnboardingPage() {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect("/login?next=%2Fonboarding");
    }

    return (
        <main className="auth-shell">
            <aside className="brand-panel" aria-label="Locagest CI">
                <div className="brand-lockup">
                    <span className="brand-mark" aria-hidden="true">
                        <Building2 size={21} strokeWidth={2.4} />
                    </span>
                    <span className="brand-name">
                        Locagest <span>CI</span>
                    </span>
                </div>
                <div className="brand-message">
                    <span className="brand-eyebrow">Votre espace de travail</span>
                    <h1>
                        Une agence.
                        <br />
                        <em>Un suivi clair.</em>
                    </h1>
                    <p>
                        Commencez par créer l’espace de votre agence. Vous pourrez ensuite y
                        organiser vos biens et vos locations.
                    </p>
                </div>
                <p className="brand-footnote">
                    Pensé pour les agences immobilières en Côte d’Ivoire.
                </p>
            </aside>

            <section className="auth-panel">
                <div className="auth-content">
                    <div className="auth-mobile-brand">
                        <span className="brand-lockup">
                            <span className="brand-mark" aria-hidden="true">
                                <Building2 size={19} strokeWidth={2.4} />
                            </span>
                            <span className="brand-name">
                                Locagest <span>CI</span>
                            </span>
                        </span>
                    </div>
                    <div className="auth-topline">
                        <span>Configuration de l’agence</span>
                        <span>Étape 1 sur 1</span>
                    </div>
                    <h2 className="auth-heading">Présentez votre agence</h2>
                    <p className="auth-description">
                        Ces informations identifieront votre espace de gestion.
                    </p>
                    <OnboardingForm email={user.email ?? ""} />
                </div>
            </section>
        </main>
    );
}