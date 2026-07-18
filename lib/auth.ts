import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { Academia, SessaoAcademia } from "./types";
import { podeAcessar, Secao } from "./permissoes";

/**
 * Resolve a sessão do administrador autenticado (usuário + academia
 * vinculada via `perfis_admin`). Cacheado por requisição com `cache()` do
 * React, então pode ser chamado em qualquer Server Component/Server Action
 * sem custo extra de round-trip.
 *
 * Retorna `null` quando não há usuário logado — quem chama decide se isso
 * deve redirecionar para /login (via `requireSessao`) ou não.
 */
export const getSessao = cache(async (): Promise<SessaoAcademia | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  let perfil: {
    id: string;
    nome: string;
    email: string;
    papel?: string;
    academia: unknown;
  } | null = (
    await supabase
      .from("perfis_admin")
      .select("id, nome, email, papel, academia:academias(*)")
      .eq("id", user.id)
      .maybeSingle()
  ).data;

  // A coluna "papel" só existe depois da migration 008. Se a consulta acima
  // falhar por causa disso, tenta de novo sem ela (assume "dono") em vez de
  // tratar o usuário como deslogado — sem isso, o painel inteiro ficaria
  // inacessível para todo mundo até a migração ser aplicada.
  if (!perfil) {
    const semPapel = await supabase
      .from("perfis_admin")
      .select("id, nome, email, academia:academias(*)")
      .eq("id", user.id)
      .maybeSingle();
    if (semPapel.data) {
      perfil = { ...semPapel.data, papel: "dono" };
    }
  }

  if (!perfil || !perfil.academia) return null;

  return {
    userId: perfil.id,
    nome: perfil.nome,
    email: perfil.email,
    papel: (perfil.papel as SessaoAcademia["papel"]) ?? "dono",
    academia: perfil.academia as unknown as Academia,
  };
});

/**
 * Exige uma sessão autenticada. Sem sessão -> redireciona para /login.
 * Se `slug` for informado e não bater com a academia da sessão, redireciona
 * para o slug correto (defesa extra além do RLS: a URL nunca mostra dados
 * de outra academia, mesmo que o admin edite o endereço manualmente).
 */
export async function requireSessao(slug?: string): Promise<SessaoAcademia> {
  const sessao = await getSessao();
  if (!sessao) redirect("/login");

  if (slug && sessao.academia.slug_url !== slug) {
    redirect(`/painel/${sessao.academia.slug_url}`);
  }

  return sessao;
}

/**
 * Exige sessão E permissão para acessar `secao`. Sem permissão -> volta para o
 * Dashboard (que todo papel enxerga). Usa-se no topo das páginas restritas
 * como defesa além de esconder o item no menu.
 */
export async function requireSecao(
  slug: string,
  secao: Secao
): Promise<SessaoAcademia> {
  const sessao = await requireSessao(slug);
  if (!podeAcessar(sessao.papel, secao)) {
    redirect(`/painel/${sessao.academia.slug_url}`);
  }
  return sessao;
}
