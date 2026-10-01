"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import {
    onboardingSchema,
    type OnboardingValues,
} from "@/lib/validations/onboarding";
import { z } from "zod";

function FieldError({ children }: { children?: string }) {
    return <span className="field-error">{children}</span>;
}

export function OnboardingForm({ email }: { email: string }) {
    const router = useRouter();
    const [error, setError] = useState("");
    const form = useForm<z.input<typeof onboardingSchema>, unknown, OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: { name: "", phone: "", city: "Abidjan" },
    });

    async function onSubmit(values: OnboardingValues) {
        setError("");
        try {
            const response = await fetch("/api/onboarding", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: values.name,
                    phone: values.phone || null,
                    city: values.city,
                }),
            });
            const result = (await response.json().catch(() => ({}))) as {
                error?: string;
                organizationId?: string;
            };

            if (response.status === 401) {
                router.replace("/login?next=%2Fonboarding");
                return;
            }
            if (!response.ok || !result.organizationId) {
                setError(result.error ?? "Impossible d’enregistrer les informations.");
                return;
            }

            router.replace("/dashboard");
            router.refresh();
        } catch {
            setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
        }
    }

    return (
        <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && (
                <div className="onboarding-error" role="alert" aria-live="polite">
                    {error}
                </div>
            )}
            <div className="field">
                <label htmlFor="agency-name">Nom de l’agence</label>
                <input
                    id="agency-name"
                    autoComplete="organization"
                    placeholder="Ex. Kouassi Immobilier"
                    aria-invalid={Boolean(form.formState.errors.name)}
                    {...form.register("name")}
                />
                <FieldError>{form.formState.errors.name?.message}</FieldError>
            </div>
            <div className="field onboarding-email">
                <label htmlFor="agency-email">Email du compte</label>
                <input id="agency-email" type="email" value={email} readOnly />
                <span className="onboarding-note">
                    Cette adresse sera utilisée comme contact de l’agence.
                </span>
            </div>
            <div className="field">
                <label htmlFor="agency-phone">Téléphone de l’agence</label>
                <input
                    id="agency-phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Ex. +225 07 00 00 00 00"
                    aria-invalid={Boolean(form.formState.errors.phone)}
                    {...form.register("phone")}
                />
                <FieldError>{form.formState.errors.phone?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="agency-city">Ville</label>
                <input
                    id="agency-city"
                    autoComplete="address-level2"
                    placeholder="Abidjan"
                    aria-invalid={Boolean(form.formState.errors.city)}
                    {...form.register("city")}
                />
                <FieldError>{form.formState.errors.city?.message}</FieldError>
            </div>
            <button className="primary-button" type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? (
                    <LoaderCircle className="spinner" aria-hidden="true" />
                ) : (
                    <ArrowRight aria-hidden="true" />
                )}
                {form.formState.isSubmitting ? "Création…" : "Créer mon espace agence"}
            </button>
        </form>
    );
}