import { redirect } from "next/navigation";
import { requireSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Resolve a academia do administrador logado e cai no painel dela. */
export default async function PainelRaiz() {
  const sessao = await requireSessao();
  redirect(`/painel/${sessao.academia.slug_url}`);
}
