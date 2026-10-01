import type { createSupabaseServerClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function resolveOwner(
  supabase: ServerSupabaseClient,
  organizationId: string,
  values: {
    ownerId?: string | null;
    newOwner?: {
      fullName: string;
      phone?: string | null;
      email?: string | null;
      idDocument?: string | null;
      notes?: string | null;
    } | null;
  },
) {
  if (values.newOwner) {
    const { data, error } = await supabase
      .from("owners")
      .insert({
        organization_id: organizationId,
        full_name: values.newOwner.fullName,
        phone: values.newOwner.phone,
        email: values.newOwner.email,
        id_document: values.newOwner.idDocument,
        notes: values.newOwner.notes,
      })
      .select("id")
      .single();
    if (error) return { error };
    return { ownerId: data.id as string, createdOwnerId: data.id as string };
  }

  if (!values.ownerId) return { ownerId: null, createdOwnerId: null };

  const { data, error } = await supabase
    .from("owners")
    .select("id")
    .eq("id", values.ownerId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { error };
  if (!data) return { missingOwner: true as const };
  return { ownerId: data.id as string, createdOwnerId: null };
}

export async function removeNewOwner(
  supabase: ServerSupabaseClient,
  organizationId: string,
  ownerId: string | null | undefined,
) {
  if (!ownerId) return true;
  const { error } = await supabase
    .from("owners")
    .delete()
    .eq("id", ownerId)
    .eq("organization_id", organizationId);
  return !error;
}
