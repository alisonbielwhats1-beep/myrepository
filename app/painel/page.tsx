import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Resolve a academia do administrador logado e cai no painel dela. */
export default async function PainelRaiz() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/admin");
  }

  const sessao = await requireSessao();
  redirect(`/painel/${sessao.academia.slug_url}`);
}
