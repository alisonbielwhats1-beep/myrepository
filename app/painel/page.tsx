import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Resolvedor pós-login UNIVERSAL. O middleware manda todo usuário autenticado
 * para cá; daqui decidimos o destino conforme o TIPO de conta:
 *   - superadmin (ADMIN_EMAILS) -> /admin;
 *   - equipe (perfis_admin)     -> painel da academia;
 *   - aluno (academia_membros)  -> /aluno (entrada por sessão, Fase 3).
 *
 * Sem este roteamento, um aluno autenticado caía em requireSessao() -> /login
 * e o middleware o trazia de volta a /painel, criando um loop. Agora o aluno é
 * encaminhado a /aluno, que resolve/So mostra o estado certo.
 */
export default async function PainelRaiz() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());

  if (adminEmails.includes(user.email?.toLowerCase() ?? "")) {
    redirect("/admin");
  }

  const sessao = await getSessao();
  if (sessao) redirect(`/painel/${sessao.academia.slug_url}`);

  // Autenticado mas não é equipe: trata como aluno. /aluno resolve o vínculo
  // (área, seleção, suspenso ou "nenhum acesso") sem voltar para /login.
  redirect("/aluno");
}
