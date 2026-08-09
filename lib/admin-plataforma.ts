import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/**
 * Guard do SUPERADMINISTRADOR DA PLATAFORMA (o dono do GestAcad), que não se
 * confunde com o papel `dono` de uma academia cliente: `Papel` é sempre
 * tenant-scoped (lib/permissoes.ts), enquanto isto aqui é acesso global.
 *
 * O mecanismo é a allowlist `ADMIN_EMAILS`, que já existia espalhada em cópias
 * dentro de app/admin. Centralizar tem dois motivos: a área de faixas
 * comerciais precisa da IDENTIDADE de quem alterou (para a auditoria da
 * migration 056), e cada cópia solta era uma chance de a regra divergir.
 *
 * Diferença de comportamento em relação às cópias antigas — duas brechas
 * fechadas, ambas fail-closed:
 *
 *   1. `"".split(",")` devolve `[""]`. Com ADMIN_EMAILS vazio ou não
 *      configurado, a lista continha uma string vazia; um usuário sem e-mail
 *      casava com ela e virava admin. Agora entradas vazias são descartadas.
 *   2. Usuário sem e-mail é recusado explicitamente, em vez de comparar `""`.
 *
 * Fora isso o comportamento é idêntico: sem sessão vai para /login, sem
 * permissão vai para /painel (mesmo destino de antes, sem revelar que a área
 * existe).
 */

/** E-mails autorizados, normalizados e sem entradas vazias. */
function emailsAutorizados(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export type AdminPlataforma = {
  userId: string;
  email: string;
};

/**
 * Exige superadministrador da plataforma. Redireciona quem não for — nunca
 * retorna para um usuário sem permissão.
 *
 * Chame no topo de CADA página e de CADA Server Action da área: Server Actions
 * são endpoints invocáveis diretamente, o guard da página não protege elas.
 *
 * Cacheado por requisição (`cache()` do React), como `getSessao`.
 */
export const requireAdminPlataforma = cache(
  async (): Promise<AdminPlataforma> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const email = user.email?.trim().toLowerCase() ?? "";
    if (!email || !emailsAutorizados().includes(email)) {
      redirect("/painel");
    }

    return { userId: user.id, email };
  }
);
