import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase douve de la cle de service.
 *
 * reserve aux taches de fond : le cron mensuel et la reception des webhooks.
 * Ces operations doivent franchir les politiques RLS, qui lient chaque echeance
 * a son agence et refusent les ecritures entre agences. La cle de service les
 * contourne, ce qui impose deux precautions :
 *
 *   - le client n est cree qu ici, jamais importe par un composant ;
 *   - toute fonction appelee doit verifier en amont que la requete porte bien
 *     sur un identifiant que le serveur a resolu, jamais sur une valeur fournie
 *     par le client.
 *
 * La cle de service ne doit jamais etre prefixee par NEXT_PUBLIC_ : ce prefixe
 * rend une variable accessible au navigateur.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !cle) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY est absente : les tâches de fond ne peuvent pas s'exécuter.",
    );
  }

  return createClient(url, cle, {
    auth: {
      // Le cron agit au nom de la plateforme, pas d'un utilisateur.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}