import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/onboarding";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("auth_error", "confirmation");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("auth_error", "confirmation");
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.redirect(new URL(nextPath, request.url));
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("auth_error", "configuration");
    return NextResponse.redirect(loginUrl);
  }
}
