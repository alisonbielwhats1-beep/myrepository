import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Fase 9 — central de alertas operacionais. Tipos e leitura. A geração roda
// no banco (supabase/migrations/041_notificacoes.sql, gerar_notificacoes_diarias)
// — este módulo só lê o que já foi gerado e expõe as configurações por
// academia. Escrita (marcar lida/dispensar/configurar) fica nas Server
// Actions de app/painel/[slug]/notificacoes/actions.ts.
// ---------------------------------------------------------------------------

export type CategoriaNotificacao =
  | "mensalidade"
  | "acesso"
  | "retencao"
  | "estoque"
  | "sistema";

export type TipoNotificacao =
  | "mensalidade_vencendo"
  | "mensalidade_atrasada"
  | "plano_vencimento"
  | "aluno_ausente"
  | "aniversario"
  | "estoque_baixo";

export type PrioridadeNotificacao = "alta" | "media" | "baixa";

export type EntidadeNotificacao = "aluno" | "mensalidade" | "produto";

export interface Notificacao {
  id: string;
  categoria: CategoriaNotificacao;
  tipo: TipoNotificacao;
  prioridade: PrioridadeNotificacao;
  titulo: string;
  mensagem: string;
  entidade: EntidadeNotificacao | null;
  entidade_id: string | null;
  data_referencia: string;
  lida_em: string | null;
  dispensada_em: string | null;
  criado_em: string;
  metadados: { aluno_id?: string; produto_id?: string; dias?: number } | null;
  /** Enriquecido na leitura (nunca persistido) — para o botão de WhatsApp. */
  alunoNome?: string;
  alunoTelefone?: string | null;
}

export interface ConfiguracoesNotificacoes {
  alerta_mensalidade_vencendo: boolean;
  alerta_mensalidade_atrasada: boolean;
  alerta_aluno_ausente: boolean;
  alerta_aniversario: boolean;
  alerta_estoque_baixo: boolean;
  aluno_ausente_dias: 7 | 14 | 30;
}

export const CONFIG_NOTIFICACOES_PADRAO: ConfiguracoesNotificacoes = {
  alerta_mensalidade_vencendo: true,
  alerta_mensalidade_atrasada: true,
  alerta_aluno_ausente: true,
  alerta_aniversario: true,
  alerta_estoque_baixo: true,
  aluno_ausente_dias: 14,
};

/** Quantas notificações a central do painel carrega — evita lista sem fim. */
const LIMITE_PAINEL = 30;

/**
 * Notificações não dispensadas da academia, mais recentes primeiro, já
 * enriquecidas com nome/telefone do aluno (quando aplicável) para o botão de
 * WhatsApp — nunca armazenados na linha, sempre lidos frescos daqui.
 */
export async function getNotificacoesPainel(
  academiaId: string
): Promise<Notificacao[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("notificacoes")
    .select(
      "id, categoria, tipo, prioridade, titulo, mensagem, entidade, entidade_id, data_referencia, lida_em, dispensada_em, criado_em, metadados"
    )
    .eq("academia_id", academiaId)
    .is("dispensada_em", null)
    .order("criado_em", { ascending: false })
    .limit(LIMITE_PAINEL);

  if (error) throw new Error(`Falha ao carregar notificações: ${error.message}`);
  const notificacoes = (data as Notificacao[]) ?? [];

  const alunoIds = Array.from(
    new Set(
      notificacoes
        .map((n) => n.metadados?.aluno_id)
        .filter((id): id is string => !!id)
    )
  );
  if (alunoIds.length === 0) return notificacoes;

  const { data: alunos } = await supabase
    .from("alunos")
    .select("id, nome, telefone")
    .eq("academia_id", academiaId)
    .in("id", alunoIds);

  const porId = new Map((alunos ?? []).map((a) => [a.id as string, a]));
  return notificacoes.map((n) => {
    const aluno = n.metadados?.aluno_id ? porId.get(n.metadados.aluno_id) : undefined;
    return aluno
      ? { ...n, alunoNome: aluno.nome as string, alunoTelefone: aluno.telefone as string | null }
      : n;
  });
}

/** Contador do sino — só não lidas e não dispensadas (Fase 9: "baseado apenas nas não lidas"). */
export async function contarNotificacoesNaoLidas(
  academiaId: string
): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academiaId)
    .is("lida_em", null)
    .is("dispensada_em", null);
  if (error) throw new Error(`Falha ao contar notificações: ${error.message}`);
  return count ?? 0;
}

/** Configurações da academia, com os padrões (tudo habilitado, 14 dias) quando ainda não há linha. */
export async function getConfiguracoesNotificacoes(
  academiaId: string
): Promise<ConfiguracoesNotificacoes> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("configuracoes_notificacoes")
    .select(
      "alerta_mensalidade_vencendo, alerta_mensalidade_atrasada, alerta_aluno_ausente, alerta_aniversario, alerta_estoque_baixo, aluno_ausente_dias"
    )
    .eq("academia_id", academiaId)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao carregar configurações de notificações: ${error.message}`);
  }
  return data
    ? { ...CONFIG_NOTIFICACOES_PADRAO, ...data }
    : CONFIG_NOTIFICACOES_PADRAO;
}
