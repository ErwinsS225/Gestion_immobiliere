"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CircleHelp } from "lucide-react";
import { AuthForm, type AuthMode } from "@/components/auth-form";
import { RotatingPitch } from "@/components/rotating-pitch";

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

/**
 * Suit le pointeur sur le panneau de marque et anime un halo qui le suit avec du
 * retard, plus une vignette qui accentue lumiere la ou l on regarde.
 *
 * Le halo se deplace en CSS : la position est mise a jour dans deux variables
 * depuis une seule frame, et la transition fait le retard. Aucun rendu React
 * n est declenche par le mouvement de la souris, sinon chaque pixel parcouru
 * provoquerait un rendu du formulaire de connexion a cote.
 *
 * L effet est purement decoratif : il est neutralise si l utilisateur prefere
 * moins d animations, et absent du HTML servi au robot d indexation.
 */
function useBrandCursor() {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const noMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (noMotion.matches) return;

        let frame = 0;
        let x = 0;
        let y = 0;

        const onMove = (event: PointerEvent) => {
            const panel = ref.current;
            if (!panel) return;

            const rect = panel.getBoundingClientRect();
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;

            if (frame) return;
            frame = window.requestAnimationFrame(() => {
                frame = 0;
                panel.style.setProperty("--cursor-x", `${x}px`);
                panel.style.setProperty("--cursor-y", `${y}px`);
            });
        };

        const panel = ref.current;
        if (!panel) return;
        panel.addEventListener("pointermove", onMove);

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            panel.removeEventListener("pointermove", onMove);
        };
    }, []);

    return ref;
}

export function AuthPage({
    mode,
    initialError,
}: {
    mode: AuthMode;
    initialError?: string;
}) {
    const copy = pageCopy[mode];
    const panelRef = useBrandCursor();

    return (
        <main className="auth-shell">
            <aside className="brand-panel" aria-label="Locagest CI" ref={panelRef}>
                <span className="brand-cursor" aria-hidden="true" />
                <Link className="brand-lockup" href="/login" aria-label="Locagest CI, accueil">
                    <BrandMark />
                </Link>
                <div className="brand-message">
                    {/*
                      La zone est masquee aux lecteurs d ecran : elle change toute
                      seule, et une annonce automatique a chaque rotation
                      interromprait la lecture du formulaire juste a cote. Le
                      contenu reste dans le HTML pour l indexation.
                    */}
                    <div aria-hidden="true">
                        <RotatingPitch />
                    </div>
                    <span className="visually-hidden">
                        Sérénité opérationnelle, efficacité et gain de temps, excellence et
                        image de marque.
                    </span>
                </div>
                <div className="ledger-preview" aria-label="Aperçu de suivi locatif">
                    <div className="ledger-head">
                        <span className="ledger-title">Ce mois-ci, en un coup d&apos;œil</span>
                        <span className="ledger-period">Exemple</span>
                    </div>
                    <div className="ledger-row">
                        <span>Échéances générées</span>
                        <span className="ledger-state">
                            <i className="ledger-dot" /> Automatique
                        </span>
                    </div>
                    <div className="ledger-row">
                        <span>Paiements encaissés</span>
                        <span className="ledger-state">
                            <i className="ledger-dot" /> Pointés
                        </span>
                    </div>
                    <div className="ledger-row">
                        <span>Locataires en retard</span>
                        <span className="ledger-state">
                            <i className="ledger-dot late" /> WhatsApp envoyé
                        </span>
                    </div>
                </div>
                <p className="brand-footnote">
                    Conçu pour les agences qui vivent de leurs impayés. Côte d’Ivoire.
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