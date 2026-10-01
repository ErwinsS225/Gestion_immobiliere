import Link from "next/link";
import { ArrowLeft, Building2, CircleHelp } from "lucide-react";
import { AuthForm, type AuthMode } from "@/components/auth-form";

const pageCopy: Record<
    AuthMode,
    { title: string; description: string; topLabel: string; topHref: string }
> = {
    signup: {
        title: "Créez votre espace agence",
        description:
            "Centralisez vos lots, échéances et relances dans un espace de travail clair.",
        topLabel: "Déjà membre ?",
        topHref: "/login",
    },
    login: {
        title: "Ravi de vous revoir",
        description: "Connectez-vous pour retrouver le suivi de votre agence.",
        topLabel: "Nouvelle agence ?",
        topHref: "/signup",
    },
    "forgot-password": {
        title: "Réinitialiser le mot de passe",
        description:
            "Indiquez l’adresse associée à votre compte. Nous vous enverrons un lien de réinitialisation.",
        topLabel: "Vous avez retrouvé votre mot de passe ?",
        topHref: "/login",
    },
    "reset-password": {
        title: "Choisissez un nouveau mot de passe",
        description: "Utilisez au moins 8 caractères pour sécuriser votre compte.",
        topLabel: "Retour à la connexion",
        topHref: "/login",
    },
};

function BrandMark() {
    return (
        <span className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
                <Building2 size={21} strokeWidth={2.4} />
            </span>
            <span className="brand-name">
                Locagest <span>CI</span>
            </span>
        </span>
    );
}

export function AuthPage({
    mode,
    initialError,
}: {
    mode: AuthMode;
    initialError?: string;
}) {
    const copy = pageCopy[mode];

    return (
        <main className="auth-shell">
            <aside className="brand-panel" aria-label="Locagest CI">
                <Link className="brand-lockup" href="/login" aria-label="Locagest CI, accueil">
                    <BrandMark />
                </Link>
                <div className="brand-message">
                    <span className="brand-eyebrow">Gestion locative, maîtrisée</span>
                    <h1>
                        Vos loyers.
                        <br />
                        <em>Sans angle mort.</em>
                    </h1>
                    <p>
                        Le suivi des échéances, des paiements et des relances de votre agence,
                        réuni au même endroit.
                    </p>
                </div>
                <div className="ledger-preview" aria-label="Aperçu de suivi locatif">
                    <div className="ledger-head">
                        <span className="ledger-title">Suivi du mois</span>
                        <span className="ledger-period">Exemple</span>
                    </div>
                    <div className="ledger-row">
                        <span>Échéances enregistrées</span>
                        <span className="ledger-state">
                            <i className="ledger-dot" /> Suivi
                        </span>
                    </div>
                    <div className="ledger-row">
                        <span>Paiements reçus</span>
                        <span className="ledger-state">
                            <i className="ledger-dot" /> Pointés
                        </span>
                    </div>
                    <div className="ledger-row">
                        <span>Retards à traiter</span>
                        <span className="ledger-state">
                            <i className="ledger-dot late" /> À relancer
                        </span>
                    </div>
                </div>
                <p className="brand-footnote">
                    Pensé pour les agences immobilières en Côte d’Ivoire.
                </p>
            </aside>

            <section className="auth-panel">
                <div className="auth-content">
                    <Link className="auth-mobile-brand" href="/login" aria-label="Locagest CI">
                        <BrandMark />
                    </Link>
                    {mode === "forgot-password" && (
                        <Link className="back-link" href="/login">
                            <ArrowLeft aria-hidden="true" /> Retour à la connexion
                        </Link>
                    )}
                    <div className="auth-topline">
                        <span>{copy.topLabel}</span>
                        <Link href={copy.topHref}>
                            {mode === "login" ? "Créer un compte" : "Se connecter"}
                        </Link>
                    </div>
                    <h2 className="auth-heading">{copy.title}</h2>
                    <p className="auth-description">{copy.description}</p>
                    <AuthForm mode={mode} initialError={initialError} />
                    {mode === "signup" && (
                        <p className="auth-legal">
                            En créant un compte, vous acceptez que votre adresse email soit
                            vérifiée avant la première connexion.
                        </p>
                    )}
                    <div className="auth-divider" />
                    <p className="auth-switch">
                        <CircleHelp size={14} aria-hidden="true" /> Besoin d’aide ? Contactez votre
                        administrateur d’agence.
                    </p>
                </div>
            </section>
        </main>
    );
}