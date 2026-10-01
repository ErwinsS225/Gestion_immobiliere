import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Locagest CI | Gestion locative des agences",
    template: "%s | Locagest CI",
  },
  description:
    "Suivez les échéances locatives, les paiements et les relances de votre agence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
