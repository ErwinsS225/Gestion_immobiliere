import type { Metadata } from "next";
import { AuthPage } from "@/components/auth-page";

export const metadata: Metadata = { title: "Créer un compte" };

export default function SignupPage() {
    return <AuthPage mode="signup" />;
}