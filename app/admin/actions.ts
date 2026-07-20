"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PlanoSaas } from "@/lib/types";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/painel");
  }
  return user;
}

export async function alterarPlano(academiaId: string, plano: PlanoSaas) {
  await requireAdmin();
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("academias")
    .update({ plano_saas: plano })
    .eq("id", academiaId);
  if (error) throw new Error(error.message);
}
