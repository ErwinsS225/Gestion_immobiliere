import { NextResponse } from "next/server";
import { onboardingSchema } from "@/lib/validations/onboarding";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Le contenu envoyé est invalide." },
      { status: 400 },
    );
  }

  const parsed = onboardingSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Vérifiez les informations saisies.",
        details: parsed.error.flatten(),
      },
      { status: 422 },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Connexion requise." },
        { status: 401 },
      );
    }

    const { data: organizationId, error: rpcError } = await supabase.rpc(
      "create_organization_with_owner",
      {
        p_name: parsed.data.name,
        p_phone: parsed.data.phone || null,
        p_email: user.email ?? null,
        p_city: parsed.data.city,
      },
    );

    if (rpcError?.code === "PGRST202") {
      return NextResponse.json(
        { error: "La migration Supabase de l’onboarding doit être appliquée." },
        { status: 503 },
      );
    }

    if (rpcError || !organizationId) {
      return NextResponse.json(
        { error: "Impossible de créer l’espace de l’agence pour le moment." },
        { status: 500 },
      );
    }

    return NextResponse.json({ organizationId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Le service est momentanément indisponible." },
      { status: 503 },
    );
  }
}
