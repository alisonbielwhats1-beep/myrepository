"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { erro?: string };

/** Autentica o administrador e redireciona para o painel da sua academia. */
export async function entrarAction(
  _estado: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error || !data.user) {
    return { erro: "E-mail ou senha inválidos." };
  }

  const { data: perfil } = await supabase
    .from("perfis_admin")
    .select("academia:academias(slug_url)")
    .eq("id", data.user.id)
    .maybeSingle();

  const slug = (perfil?.academia as unknown as { slug_url: string } | null)
    ?.slug_url;

  if (!slug) {
    await supabase.auth.signOut();
    return {
      erro:
        "Este login não está vinculado a nenhuma academia. Fale com o suporte.",
    };
  }

  redirect(`/painel/${slug}`);
}

/** Encerra a sessão do administrador. */
export async function sairAction() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
