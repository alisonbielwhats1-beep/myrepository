import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Info,
  Plug,
  ShieldCheck,
} from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPlataforma } from "@/lib/admin-plataforma";

export const dynamic = "force-dynamic";

/**
 * Atividade das academias — área EXCLUSIVA do superadministrador da plataforma.
 *
 * Por que existe: a `logs_auditoria` (migration 040) gravava desde sempre e não
 * havia nenhuma tela para ler. E quando o cliente relatava um erro, a única
 * fonte era o log da Vercel — que expira e ninguém acompanha. Aqui as três
 * fontes ficam no mesmo lugar:
 *
 *   1. Auditoria   — quem fez o quê no painel de cada academia.
 *   2. Erros       — o que falhou, com o texto técnico e o que o cliente leu.
 *   3. Integrações — mudanças de status e rotação de segredo (Gympass/TotalPass).
 *
 * Segurança, nas mesmas quatro camadas de /admin/planos:
 *   1. `requireAdminPlataforma()` antes de qualquer render;
 *   2. RLS fail-closed — `logs_erros` não tem policy nenhuma;
 *   3. leitura só por `createServiceRoleClient()`, que é server-only;
 *   4. nenhum dado daqui é exposto a rota pública.
 */

const TABELA_INEXISTENTE = "42P01";
const TABELA_FORA_DO_CACHE = "PGRST205";

type Aba = "auditoria" | "erros" | "integracoes";

const ABAS: { id: Aba; rotulo: string; icone: typeof Activity }[] = [
  { id: "auditoria", rotulo: "Auditoria", icone: ShieldCheck },
  { id: "erros", rotulo: "Erros", icone: AlertTriangle },
  { id: "integracoes", rotulo: "Integrações", icone: Plug },
];

/** Ações da auditoria em linguagem de gente. */
const ROTULO_ACAO: Record<string, string> = {
  aluno_criado: "cadastrou um aluno",
  aluno_atualizado: "editou um aluno",
  aluno_excluido: "excluiu um aluno",
  plano_alterado: "alterou o plano de um aluno",
  mensalidade_paga: "deu baixa numa mensalidade",
  mensalidade_cancelada: "cancelou uma mensalidade",
  equipe_criado: "adicionou alguém à equipe",
  equipe_removido: "removeu alguém da equipe",
  equipe_papel_alterado: "mudou a permissão de alguém",
  funcionario_excluido: "excluiu um funcionário",
  // Financeiro (migration 063). As exclusões vêm com destaque visual na tabela:
  // são as ações que fazem dinheiro sumir do sistema.
  receita_criada: "lançou uma receita",
  receita_atualizada: "editou uma receita",
  receita_excluida: "EXCLUIU uma receita",
  despesa_criada: "lançou uma despesa",
  despesa_atualizada: "editou uma despesa",
  despesa_excluida: "EXCLUIU uma despesa",
  venda_estornada: "estornou uma venda da loja",
  pagamento_retroativo: "registrou a data de um pagamento antigo",
  saldo_inicial_definido: "alterou o saldo inicial da academia",
};

/** Ações que fazem um valor desaparecer — merecem destaque na listagem. */
const ACOES_CRITICAS = new Set([
  "receita_excluida",
  "despesa_excluida",
  "venda_estornada",
  "aluno_excluido",
  "saldo_inicial_definido",
]);

/**
 * Data e hora no fuso da academia.
 *
 * Explicitar o `timeZone` é obrigatório aqui: isto é um Server Component, e o
 * servidor da Vercel roda em UTC. Sem isso, um cadastro feito às 21h em São
 * Paulo apareceria como sendo do dia seguinte — e a tela existe justamente
 * para responder "o que aconteceu hoje".
 */
function dataHoraSP(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function tabelaFaltando(codigo?: string): boolean {
  return codigo === TABELA_INEXISTENTE || codigo === TABELA_FORA_DO_CACHE;
}

export default async function AtividadePage({
  searchParams,
}: {
  searchParams: { aba?: string };
}) {
  await requireAdminPlataforma();

  const abaAtual: Aba = ABAS.some((a) => a.id === searchParams.aba)
    ? (searchParams.aba as Aba)
    : "auditoria";

  const admin = createServiceRoleClient();

  // As três consultas rodam juntas: o custo é o da mais lenta, e a tela mostra
  // a contagem de todas as abas no cabeçalho, não só a que está aberta.
  const [auditoriaRes, errosRes, integracoesRes] = await Promise.all([
    admin
      .from("logs_auditoria")
      .select("id, usuario_nome, entidade, acao, criado_em, academias(nome_fantasia)")
      .order("criado_em", { ascending: false })
      .limit(100),
    admin
      .from("logs_erros")
      .select(
        "id, academia_nome, usuario_nome, acao, codigo, mensagem_tecnica, mensagem_usuario, criado_em"
      )
      .order("criado_em", { ascending: false })
      .limit(100),
    admin
      .from("log_integracoes")
      .select("id, plataforma, acao, status_anterior, status_novo, criado_em, academias(nome_fantasia)")
      .order("criado_em", { ascending: false })
      .limit(100),
  ]);

  return (
    <div className="min-h-screen bg-ink-950 p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="mb-2 inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-volt-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao painel
            </Link>
            <h1 className="text-2xl font-bold text-white">Atividade das academias</h1>
            <p className="text-sm text-slate-400">
              Os 100 registros mais recentes de cada fonte · horário de Brasília
            </p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex flex-wrap gap-2">
          {ABAS.map(({ id, rotulo, icone: Icone }) => {
            const ativa = id === abaAtual;
            return (
              <Link
                key={id}
                href={`/admin/atividade?aba=${id}`}
                className={
                  ativa
                    ? "flex items-center gap-2 rounded-xl border border-volt-500/40 bg-volt-500/10 px-3 py-2 text-sm font-semibold text-volt-300"
                    : "flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-volt-500/40 hover:text-volt-300"
                }
              >
                <Icone className="h-4 w-4" />
                {rotulo}
              </Link>
            );
          })}
        </div>

        {abaAtual === "auditoria" &&
          (tabelaFaltando(auditoriaRes.error?.code) ? (
            <MigrationPendente
              numero="040"
              arquivo="040_auditoria.sql"
              oQueDestrava="o histórico de quem cadastra, edita e exclui em cada academia"
            />
          ) : (
            <Auditoria linhas={(auditoriaRes.data ?? []) as unknown as LinhaAuditoria[]} />
          ))}

        {abaAtual === "erros" &&
          (tabelaFaltando(errosRes.error?.code) ? (
            <MigrationPendente
              numero="061"
              arquivo="061_logs_erros.sql"
              oQueDestrava="o registro dos erros que o cliente vê na tela"
            />
          ) : (
            <Erros linhas={(errosRes.data ?? []) as unknown as LinhaErro[]} />
          ))}

        {abaAtual === "integracoes" &&
          (tabelaFaltando(integracoesRes.error?.code) ? (
            <MigrationPendente
              numero="022"
              arquivo="022_integracao_status_e_audit.sql"
              oQueDestrava="o histórico de mudanças nas integrações Gympass e TotalPass"
            />
          ) : (
            <Integracoes
              linhas={(integracoesRes.data ?? []) as unknown as LinhaIntegracao[]}
            />
          ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tipos das linhas (o embed do PostgREST vem como objeto ou array conforme a
// cardinalidade, por isso `academias` é tratado com cuidado em cada tabela)
// ---------------------------------------------------------------------------

type ComAcademia = { academias: { nome_fantasia: string } | null };

type LinhaAuditoria = ComAcademia & {
  id: string;
  usuario_nome: string;
  entidade: string;
  acao: string;
  criado_em: string;
};

type LinhaErro = {
  id: string;
  academia_nome: string | null;
  usuario_nome: string | null;
  acao: string;
  codigo: string | null;
  mensagem_tecnica: string | null;
  mensagem_usuario: string | null;
  criado_em: string;
};

type LinhaIntegracao = ComAcademia & {
  id: string;
  plataforma: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  criado_em: string;
};

function nomeAcademia(linha: ComAcademia): string {
  return linha.academias?.nome_fantasia ?? "—";
}

// ---------------------------------------------------------------------------
// Blocos de conteúdo
// ---------------------------------------------------------------------------

function Vazio({ texto }: { texto: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-8 text-center">
      <Activity className="mx-auto mb-3 h-8 w-8 text-slate-600" />
      <p className="text-sm text-slate-400">{texto}</p>
    </div>
  );
}

function Auditoria({ linhas }: { linhas: LinhaAuditoria[] }) {
  if (linhas.length === 0) {
    return (
      <Vazio texto="Nenhuma ação registrada ainda. A auditoria grava a partir do momento em que a migration 040 foi aplicada — nada anterior a isso existe." />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-900">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Quando</th>
            <th className="px-4 py-3 font-semibold">Academia</th>
            <th className="px-4 py-3 font-semibold">Quem</th>
            <th className="px-4 py-3 font-semibold">O que fez</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {linhas.map((l) => (
            <tr key={l.id} className="transition-colors hover:bg-ink-800/50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                {dataHoraSP(l.criado_em)}
              </td>
              <td className="px-4 py-3 text-slate-300">{nomeAcademia(l)}</td>
              <td className="px-4 py-3 font-medium text-white">{l.usuario_nome}</td>
              <td
                className={
                  ACOES_CRITICAS.has(l.acao)
                    ? "px-4 py-3 font-medium text-amber-300"
                    : "px-4 py-3 text-slate-300"
                }
              >
                {ROTULO_ACAO[l.acao] ?? `${l.acao} (${l.entidade})`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Erros({ linhas }: { linhas: LinhaErro[] }) {
  if (linhas.length === 0) {
    return (
      <Vazio texto="Nenhum erro registrado. É o resultado desejado — esta lista só enche quando alguma tela falha para o cliente." />
    );
  }

  return (
    <div className="space-y-3">
      {linhas.map((l) => (
        <div
          key={l.id}
          className="rounded-2xl border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-red-500/30"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{dataHoraSP(l.criado_em)}</span>
            <span>·</span>
            <span className="text-slate-400">{l.academia_nome ?? "academia não identificada"}</span>
            {l.usuario_nome && (
              <>
                <span>·</span>
                <span className="text-slate-400">{l.usuario_nome}</span>
              </>
            )}
            {l.codigo && (
              <span className="chip border-red-500/30 bg-red-500/10 text-[10px] font-semibold uppercase text-red-300">
                {l.codigo}
              </span>
            )}
          </div>

          <p className="mt-2 font-medium text-white">
            Falhou ao {l.acao}
          </p>

          {/* O que o cliente leu — é por esta frase que ele vai descrever o
              problema quando ligar, então ela vem primeiro. */}
          {l.mensagem_usuario && (
            <p className="mt-1 text-sm text-slate-300">
              <span className="text-slate-500">Cliente viu: </span>
              {l.mensagem_usuario}
            </p>
          )}

          {l.mensagem_tecnica && (
            <p className="mt-1 break-words font-mono text-xs text-slate-500">
              {l.mensagem_tecnica}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function Integracoes({ linhas }: { linhas: LinhaIntegracao[] }) {
  if (linhas.length === 0) {
    return <Vazio texto="Nenhuma alteração de integração registrada." />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-ink-700 bg-ink-900">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-semibold">Quando</th>
            <th className="px-4 py-3 font-semibold">Academia</th>
            <th className="px-4 py-3 font-semibold">Plataforma</th>
            <th className="px-4 py-3 font-semibold">O que mudou</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-800">
          {linhas.map((l) => (
            <tr key={l.id} className="transition-colors hover:bg-ink-800/50">
              <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                {dataHoraSP(l.criado_em)}
              </td>
              <td className="px-4 py-3 text-slate-300">{nomeAcademia(l)}</td>
              <td className="px-4 py-3 capitalize text-slate-300">{l.plataforma}</td>
              <td className="px-4 py-3 text-slate-300">
                {l.acao === "rotacao_secret"
                  ? "gerou uma nova chave secreta"
                  : `status: ${l.status_anterior ?? "—"} → ${l.status_novo ?? "—"}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A migration correspondente ainda não foi aplicada neste banco. Explica o que
 * fazer em vez de estourar uma tela de erro — mesmo padrão de /admin/planos.
 */
function MigrationPendente({
  numero,
  arquivo,
  oQueDestrava,
}: {
  numero: string;
  arquivo: string;
  oQueDestrava: string;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="space-y-2">
          <h2 className="font-semibold text-white">
            Migration {numero} ainda não aplicada
          </h2>
          <p className="text-sm text-slate-300">
            Esta aba mostra {oQueDestrava}. A tabela que guarda esses dados ainda
            não existe neste banco.
          </p>
          <p className="text-sm text-slate-400">
            Para ativar: execute{" "}
            <code className="rounded bg-ink-800 px-1.5 py-0.5 font-mono text-xs text-volt-300">
              supabase/migrations/{arquivo}
            </code>{" "}
            no SQL Editor do Supabase. Nada é perdido enquanto isso — só não há
            registro do período anterior à aplicação.
          </p>
        </div>
      </div>
    </div>
  );
}
