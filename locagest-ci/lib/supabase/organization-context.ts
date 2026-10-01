import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireOrganization(write = false) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      response: NextResponse.json({ error: "Connexion requise." }, { status: 401 }),
    };
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Impossible de vérifier l’accès à votre agence." },
        { status: 500 },
      ),
    };
  }

  if (!membership) {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Aucune agence n’est associée à votre compte. Terminez d’abord la configuration." },
        { status: 404 },
      ),
    };
  }

  if (write && membership.role === "viewer") {
    return {
      supabase,
      response: NextResponse.json(
        { error: "Votre rôle ne permet pas de modifier le patrimoine. Contactez un responsable de l’agence." },
        { status: 403 },
      ),
    };
  }

  return {
    supabase,
    organizationId: membership.organization_id as string,
    response: null,
  };
}

export function databaseErrorResponse(
  error: { code?: string; message?: string },
  fallback: string,
) {
  if (error.code === "23505") {
    return NextResponse.json(
      { error: "Un lot portant ce libellé existe déjà dans ce bien. Choisissez un autre libellé." },
      { status: 409 },
    );
  }
  if (error.code === "42501") {
    return NextResponse.json(
      { error: "Votre rôle ne permet pas cette modification. Contactez un responsable de l’agence." },
      { status: 403 },
    );
  }
  if (error.code === "23503") {
    return NextResponse.json(
      { error: "Le bien ou le propriétaire sélectionné n’est plus disponible dans votre agence." },
      { status: 422 },
    );
  }
  if (error.code === "23514" || error.code === "22003" || error.code === "22P02") {
    return NextResponse.json(
      { error: "Certaines informations ne respectent pas les limites autorisées. Vérifiez les champs indiqués." },
      { status: 422 },
    );
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export function validationErrorResponse(
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
  summary: string,
) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    fieldErrors[key] ??= issue.message;
  }
  return NextResponse.json({ error: summary, fieldErrors }, { status: 422 });
}
