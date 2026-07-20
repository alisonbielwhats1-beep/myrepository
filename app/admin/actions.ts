"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { PlanoSaas } from "@/lib/types";

export async function alterarPlano(academiaId: string, plano: PlanoSaas, token: string) {
  const adminSecret = process.env.ADMIN_SECRET ?? "";
  if (!adminSecret || token !== adminSecret) {
    throw new Error("Não autorizado.");
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("academias")
    .update({ plano_saas: plano })
    .eq("id", academiaId);

  if (error) throw new Error(error.message);
}
