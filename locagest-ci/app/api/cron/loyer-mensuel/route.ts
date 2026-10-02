import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Tâche quotidienne de la plateforme.
 *
 * Deux opérations, dans l'ordre :
 *   1. génération des échéances du mois en cours pour chaque bail actif ;
 *   2. bascule en retard des échéances échues depuis plus de cinq jours.
 *
 * L'ordre compte : une échéance créée aujourd'hui ne doit pas être marquée en
 * retard dans la foulée. C'est le cas ici puisqu'elle n'est pas échue, mais
 * l'ordre évite qu'une échéance générée tardivement dans le mois soit traitée
 * par la seconde opération avant d'avoir reçu son échéance du mois suivant.
 *
 * La route est protégée par CRON_SECRET : Vercel envoie cet en-tête en
 * production, et une comparaison à temps constant évite qu'un attaquant ne
 * retrouve le secret en mesurant le temps de réponse.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET n’est pas configuré sur le serveur." },
      { status: 500 },
    );
  }

  if (!estSecretValide(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const maintenant = new Date();
  const annee = maintenant.getUTCFullYear();
  const mois = maintenant.getUTCMonth() + 1;

  try {
    const supabase = createServiceClient();

    const { data: creees, error: erreurGeneration } = await supabase.rpc(
      "generate_monthly_rent_calls",
      { p_year: annee, p_month: mois },
    );
    if (erreurGeneration) {
      return NextResponse.json(
        { error: "La génération des échéances a échoué.", detail: erreurGeneration.message },
        { status: 500 },
      );
    }

    const { data: enRetard, error: erreurRetard } =
      await supabase.rpc("mark_overdue_rent_calls");
    if (erreurRetard) {
      return NextResponse.json(
        { error: "Le repérage des retards a échoué.", detail: erreurRetard.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      periode: `${annee}-${String(mois).padStart(2, "0")}`,
      echeancesCreees: creees ?? 0,
      echeancesMarqueesEnRetard: enRetard ?? 0,
      executeLe: maintenant.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "La tâche n’a pas pu s’exécuter.",
        detail: error instanceof Error ? error.message : "erreur inconnue",
      },
      { status: 503 },
    );
  }
}

/** Compare le secret à temps constant, pour ne pas en révéler la valeur par le temps de réponse. */
function estSecretValide(autorisation: string | null, secret: string): boolean {
  if (!autorisation?.startsWith("Bearer ")) return false;

  const fourni = autorisation.slice("Bearer ".length);
  if (fourni.length !== secret.length) return false;

  let ecart = 0;
  for (let i = 0; i < secret.length; i += 1) {
    ecart |= fourni.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return ecart === 0;
}