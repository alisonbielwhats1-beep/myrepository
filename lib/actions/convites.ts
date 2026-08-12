"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessao } from "@/lib/auth";
import {
  gerarTokenConvite,
  hashTokenConvite,
  calcularExpiracao,
  montarLinkConvite,
} from "@/lib/convites";

/** URL base do site (domínio autorizado) para montar o link do convite. */
function urlBase(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type ResultadoConvite =
  | { ok: true; link: string; expiraEm: string }
  | { ok: false; erro: string };

/**
 * A academia gera um convite de ativação para um aluno existente.
 *
 * O token bruto é gerado AQUI (servidor), transformado em hash e só o hash vai
 * ao banco (RPC gerar_convite_acesso). O link com o token bruto é devolvido
 * UMA vez para o admin copiar/entregar — nunca fica guardado. A RPC valida que
 * o aluno é da academia do admin logado (isolamento) e revoga convite anterior.
 */
export async function gerarConviteAluno(
  alunoId: string,
  expiracaoDias?: number
): Promise<ResultadoConvite> {
  const sessao = await getSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const tokenBruto = gerarTokenConvite();
  const tokenHash = hashTokenConvite(tokenBruto);
  const expiraEm = calcularExpiracao(expiracaoDias ?? undefined);

  const supabase = createClient();
  const { error } = await supabase.rpc("gerar_convite_acesso", {
    p_aluno_id: alunoId,
    p_token_hash: tokenHash,
    p_expira_em: expiraEm,
  });

  if (error) {
    return {
      ok: false,
      erro: "Não foi possível gerar o convite. Verifique se o aluno é da sua academia.",
    };
  }

  return {
    ok: true,
    link: montarLinkConvite(urlBase(), tokenBruto),
    expiraEm,
  };
}

export type ItemLote = { alunoId: string; ok: boolean; link?: string; erro?: string };

/**
 * Gera convites para VÁRIOS alunos de uma vez (lote). Cria convites — nunca
 * contas nem senhas. Cada aluno é validado pela própria RPC (isolamento por
 * academia); um erro em um aluno não interrompe os demais. Devolve o link
 * bruto de cada convite UMA vez, para a academia copiar/enviar/exportar.
 *
 * Limitado a um teto por chamada para não estourar tempo/uso — a UI pode
 * paginar lotes grandes.
 */
export async function gerarConvitesEmLote(
  alunoIds: string[],
  expiracaoDias?: number
): Promise<ItemLote[]> {
  const sessao = await getSessao();
  if (!sessao) return alunoIds.map((id) => ({ alunoId: id, ok: false, erro: "sessao" }));

  const ids = Array.from(new Set(alunoIds)).slice(0, 200);
  const supabase = createClient();
  const base = urlBase();
  const resultados: ItemLote[] = [];

  for (const alunoId of ids) {
    const tokenBruto = gerarTokenConvite();
    const { error } = await supabase.rpc("gerar_convite_acesso", {
      p_aluno_id: alunoId,
      p_token_hash: hashTokenConvite(tokenBruto),
      p_expira_em: calcularExpiracao(expiracaoDias ?? undefined),
    });
    if (error) {
      resultados.push({ alunoId, ok: false, erro: "Falha ao gerar" });
    } else {
      resultados.push({ alunoId, ok: true, link: montarLinkConvite(base, tokenBruto) });
    }
  }

  return resultados;
}

export type ResultadoSimples = { ok: boolean; erro?: string };

/** A academia revoga um convite ainda não utilizado. */
export async function revogarConvite(conviteId: string): Promise<ResultadoSimples> {
  const sessao = await getSessao();
  if (!sessao) return { ok: false, erro: "Sessão expirada. Entre novamente." };

  const supabase = createClient();
  const { error } = await supabase.rpc("revogar_convite_acesso", {
    p_convite_id: conviteId,
  });
  if (error) {
    return { ok: false, erro: "Não foi possível revogar este convite." };
  }
  return { ok: true };
}

export type ResumoMigracao = {
  total: number;
  ja_vinculados: number;
  com_dados_pendentes: number;
  aptos_a_convidar: number;
  conflitos_conta_duplicada: number;
} | null;

/** Dry-run read-only da migração de acesso (contagens da própria academia). */
export async function auditarMigracaoAcesso(): Promise<ResumoMigracao> {
  const sessao = await getSessao();
  if (!sessao) return null;
  const supabase = createClient();
  const { data, error } = await supabase.rpc("auditar_migracao_alunos");
  if (error || !data) return null;
  return data as ResumoMigracao;
}
