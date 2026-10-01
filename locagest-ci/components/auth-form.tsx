"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, LoaderCircle, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthMode = "signup" | "login" | "forgot-password" | "reset-password";

const signupSchema = z
    .object({
        fullName: z.string().trim().min(2, "Saisissez votre nom complet."),
        email: z.string().trim().email("Saisissez une adresse email valide."),
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
        confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
    })
    .refine((values) => values.password === values.confirmPassword, {
        message: "Les mots de passe ne correspondent pas.",
        path: ["confirmPassword"],
    });

const loginSchema = z.object({
    email: z.string().trim().email("Saisissez une adresse email valide."),
    password: z.string().min(1, "Saisissez votre mot de passe."),
});

const emailSchema = z.object({
    email: z.string().trim().email("Saisissez une adresse email valide."),
});

const resetSchema = z
    .object({
        password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères."),
        confirmPassword: z.string().min(1, "Confirmez votre mot de passe."),
    })
    .refine((values) => values.password === values.confirmPassword, {
        message: "Les mots de passe ne correspondent pas.",
        path: ["confirmPassword"],
    });

type SignupValues = z.infer<typeof signupSchema>;
type LoginValues = z.infer<typeof loginSchema>;
type EmailValues = z.infer<typeof emailSchema>;
type ResetValues = z.infer<typeof resetSchema>;

function friendlyError(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";

    if (message.includes("supabase") && message.includes("env")) {
        return "L’authentification n’est pas encore configurée. Ajoutez les clés Supabase dans le fichier .env.local.";
    }
    if (message.includes("invalid login credentials")) {
        return "Adresse email ou mot de passe incorrect.";
    }
    if (message.includes("email not confirmed")) {
        return "Confirmez votre adresse email avant de vous connecter.";
    }
    if (message.includes("user already registered")) {
        return "Un compte utilise déjà cette adresse email. Essayez de vous connecter.";
    }
    if (message.includes("rate limit") || message.includes("too many requests")) {
        return "Trop de demandes en peu de temps. Réessayez dans quelques minutes.";
    }
    return "Une erreur est survenue. Vérifiez les informations saisies puis réessayez.";
}

function getSafeNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next?.startsWith("/") && !next.startsWith("//") ? next : null;
}

function FieldError({ children }: { children?: string }) {
    return <span className="field-error">{children}</span>;
}

function FormFeedback({
    children,
    success = false,
}: {
    children: string;
    success?: boolean;
}) {
    return (
        <div className={`auth-feedback${success ? " success" : ""}`} role="status" aria-live="polite">
            {success ? <Check aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
            <span>{children}</span>
        </div>
    );
}

function SubmitButton({ children, loading }: { children: string; loading: boolean }) {
    return (
        <button className="primary-button" type="submit" disabled={loading}>
            {loading && <LoaderCircle className="spinner" aria-hidden="true" />}
            {loading ? "Traitement…" : children}
        </button>
    );
}

function SignupForm() {
    const [error, setError] = useState("");
    const [emailSent, setEmailSent] = useState("");
    const [resendMessage, setResendMessage] = useState("");
    const [resending, setResending] = useState(false);
    const form = useForm<SignupValues>({
        resolver: zodResolver(signupSchema),
        defaultValues: { fullName: "", email: "", password: "", confirmPassword: "" },
    });

    async function onSubmit(values: SignupValues) {
        setError("");
        try {
            const supabase = createSupabaseBrowserClient();
            const { error: signupError } = await supabase.auth.signUp({
                email: values.email,
                password: values.password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fonboarding`,
                    data: { full_name: values.fullName },
                },
            });
            if (signupError) {
                setError(friendlyError(signupError));
                return;
            }
            setEmailSent(values.email);
        } catch (signupError) {
            setError(friendlyError(signupError));
        }
    }

    async function resendConfirmation() {
        setResending(true);
        setResendMessage("");
        try {
            const supabase = createSupabaseBrowserClient();
            const { error: resendError } = await supabase.auth.resend({
                type: "signup",
                email: emailSent,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback?next=%2Fonboarding`,
                },
            });
            setResendMessage(
                resendError
                    ? friendlyError(resendError)
                    : "Si cette adresse peut recevoir un lien de confirmation, un nouvel email vient d’être envoyé.",
            );
        } catch (resendError) {
            setResendMessage(friendlyError(resendError));
        } finally {
            setResending(false);
        }
    }

    if (emailSent) {
        return (
            <div className="confirmation-panel">
                <span className="confirmation-icon">
                    <MailCheck aria-hidden="true" />
                </span>
                <h3>Vérifiez votre boîte email</h3>
                <p>
                    Un lien de confirmation a été envoyé à <strong>{emailSent}</strong>. Ouvrez-le
                    pour activer votre compte.
                </p>
                {resendMessage && <FormFeedback success={!resendMessage.startsWith("Une erreur")}>{resendMessage}</FormFeedback>}
                <div className="confirmation-actions">
                    <button className="text-button" onClick={resendConfirmation} disabled={resending}>
                        {resending ? "Envoi…" : "Renvoyer l’email"}
                    </button>
                    <Link className="text-link" href="/login">
                        Aller à la connexion
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <FormFeedback>{error}</FormFeedback>}
            <div className="field">
                <label htmlFor="signup-name">Nom complet</label>
                <input
                    id="signup-name"
                    autoComplete="name"
                    placeholder="Ex. Aminata Kouassi"
                    aria-invalid={Boolean(form.formState.errors.fullName)}
                    {...form.register("fullName")}
                />
                <FieldError>{form.formState.errors.fullName?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="signup-email">Adresse email</label>
                <input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@agence.ci"
                    aria-invalid={Boolean(form.formState.errors.email)}
                    {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="signup-password">Mot de passe</label>
                <input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    aria-invalid={Boolean(form.formState.errors.password)}
                    {...form.register("password")}
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="signup-confirm-password">Confirmer le mot de passe</label>
                <input
                    id="signup-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Ressaisissez le mot de passe"
                    aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                    {...form.register("confirmPassword")}
                />
                <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
            </div>
            <SubmitButton loading={form.formState.isSubmitting}>Créer mon compte</SubmitButton>
        </form>
    );
}

function LoginForm({ initialError }: { initialError?: string }) {
    const router = useRouter();
    const [error, setError] = useState(initialError ?? "");
    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: "", password: "" },
    });

    async function onSubmit(values: LoginValues) {
        setError("");
        try {
            const supabase = createSupabaseBrowserClient();
            const { error: loginError } = await supabase.auth.signInWithPassword(values);
            if (loginError) {
                setError(friendlyError(loginError));
                return;
            }

            const nextPath = getSafeNextPath();
            if (nextPath) {
                router.replace(nextPath);
                router.refresh();
                return;
            }

            const { data: membership } = await supabase
                .from("memberships")
                .select("organization_id")
                .limit(1)
                .maybeSingle();
            router.replace(membership?.organization_id ? "/dashboard" : "/onboarding");
            router.refresh();
        } catch (loginError) {
            setError(friendlyError(loginError));
        }
    }

    return (
        <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <FormFeedback>{error}</FormFeedback>}
            <div className="field">
                <label htmlFor="login-email">Adresse email</label>
                <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@agence.ci"
                    aria-invalid={Boolean(form.formState.errors.email)}
                    {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="login-password">Mot de passe</label>
                <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    aria-invalid={Boolean(form.formState.errors.password)}
                    {...form.register("password")}
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
            </div>
            <div className="form-options">
                <Link className="text-link" href="/forgot-password">
                    Mot de passe oublié ?
                </Link>
            </div>
            <SubmitButton loading={form.formState.isSubmitting}>Se connecter</SubmitButton>
        </form>
    );
}

function ForgotPasswordForm() {
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);
    const form = useForm<EmailValues>({
        resolver: zodResolver(emailSchema),
        defaultValues: { email: "" },
    });

    async function onSubmit(values: EmailValues) {
        setError("");
        try {
            const supabase = createSupabaseBrowserClient();
            const redirectTo = `${window.location.origin}/auth/callback?next=%2Freset-password`;
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(values.email, {
                redirectTo,
            });
            if (resetError) {
                setError(friendlyError(resetError));
                return;
            }
            setSent(true);
        } catch (resetError) {
            setError(friendlyError(resetError));
        }
    }

    if (sent) {
        return (
            <div className="confirmation-panel">
                <span className="confirmation-icon">
                    <MailCheck aria-hidden="true" />
                </span>
                <h3>Vérifiez votre boîte email</h3>
                <p>
                    Si un compte correspond à cette adresse, vous recevrez un lien pour choisir un
                    nouveau mot de passe.
                </p>
                <Link className="text-link" href="/login">
                    Retour à la connexion
                </Link>
            </div>
        );
    }

    return (
        <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <FormFeedback>{error}</FormFeedback>}
            <div className="field">
                <label htmlFor="forgot-email">Adresse email</label>
                <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@agence.ci"
                    aria-invalid={Boolean(form.formState.errors.email)}
                    {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
            </div>
            <SubmitButton loading={form.formState.isSubmitting}>Envoyer le lien</SubmitButton>
        </form>
    );
}

function ResetPasswordForm() {
    const [error, setError] = useState("");
    const [updated, setUpdated] = useState(false);
    const form = useForm<ResetValues>({
        resolver: zodResolver(resetSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });

    async function onSubmit(values: ResetValues) {
        setError("");
        try {
            const supabase = createSupabaseBrowserClient();
            const { error: updateError } = await supabase.auth.updateUser({
                password: values.password,
            });
            if (updateError) {
                setError(friendlyError(updateError));
                return;
            }
            await supabase.auth.signOut();
            setUpdated(true);
        } catch (updateError) {
            setError(friendlyError(updateError));
        }
    }

    if (updated) {
        return (
            <div className="confirmation-panel">
                <span className="confirmation-icon">
                    <Check aria-hidden="true" />
                </span>
                <h3>Mot de passe modifié</h3>
                <p>Votre nouveau mot de passe est actif. Vous pouvez vous connecter.</p>
                <Link className="text-link" href="/login">
                    Aller à la connexion
                </Link>
            </div>
        );
    }

    return (
        <form className="auth-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            {error && <FormFeedback>{error}</FormFeedback>}
            <div className="field">
                <label htmlFor="reset-password">Nouveau mot de passe</label>
                <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="8 caractères minimum"
                    aria-invalid={Boolean(form.formState.errors.password)}
                    {...form.register("password")}
                />
                <FieldError>{form.formState.errors.password?.message}</FieldError>
            </div>
            <div className="field">
                <label htmlFor="reset-confirm-password">Confirmer le mot de passe</label>
                <input
                    id="reset-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Ressaisissez le mot de passe"
                    aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                    {...form.register("confirmPassword")}
                />
                <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
            </div>
            <SubmitButton loading={form.formState.isSubmitting}>Enregistrer le mot de passe</SubmitButton>
        </form>
    );
}

export function AuthForm({
    mode,
    initialError,
}: {
    mode: AuthMode;
    initialError?: string;
}) {
    if (mode === "signup") return <SignupForm />;
    if (mode === "login") return <LoginForm initialError={initialError} />;
    if (mode === "forgot-password") return <ForgotPasswordForm />;
    return <ResetPasswordForm />;
}