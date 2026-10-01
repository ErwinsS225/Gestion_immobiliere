import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ auth_error?: string }>;
}) {
    const { auth_error: authError } = await searchParams;
    const initialError =
        authError === "confirmation"
            ? "Le lien de confirmation est invalide ou a expiré. Demandez-en un nouveau."
            : authError === "configuration"
                ? "L’authentification n’est pas encore configurée pour cette application."
                : "";

    return <AuthPage mode="login" initialError={initialError} />;
}