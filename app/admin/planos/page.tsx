import Link from "next/link";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdminPlataforma } from "@/lib/admin-plataforma";
import { intervaloLabel, MENSAGEM_ACIMA_DA_TABELA } from "@/lib/faixas-comerciais";
import { PRECO_MENSAL_LABEL } from "@/lib/site-config";
import { FaixaComercial } from "@/lib/types";
import { formatBRL, formatDataHoraCompleta } from "@/lib/utils";
import FaixaForm from "./FaixaForm";

export const dynamic = "force-dynamic";

/**
 * Configuração comercial — faixas de preço por quantidade de alunos ativos.
 *
 * Área EXCLUSIVA do superadministrador da plataforma. Quatro camadas seguram
 * o acesso, nenhuma delas "esconder o menu":
 *   1. `requireAdminPlataforma()` aqui, antes de qualquer render;
 *   2. o mesmo guard no topo de cada Server Action (./actions.ts);
 *   3. RLS fail-closed no banco — sem policy para anon/authenticated;
 *   4. leitura só por `createServiceRoleClient()`, que é server-only.
 *
 * Os valores daqui NÃO aparecem na landing pública e não cobram nada: são
 * referência para apresentação, negociação e proposta.
 */

type LogRow = {
  id: string;
  faixa_nome: string;
  usuario_email: string;
  acao: string;
  valor_anterior: Record<string, unknown> | null;
  valor_novo: Record<string, unknown> | null;
  motivo: string | null;
  registrado_em: string;
};

const TABELA_INEXISTENTE = "42P01";

export default async function PlanosComerciaisPage() {
  await requireAdminPlataforma();

  const admin = createServiceRoleClient();

  const [faixasRes, logRes] = await Promise.all([
    admin.from("faixas_comerciais").select("*").order("ordem"),
    admin
      .from("faixas_comerciais_log")
      .select("*")
      .order("registrado_em", { ascending: false })
      .limit(20),
  ]);

  // A migration é aplicada à mão no SQL Editor do Supabase. Enquanto não for,
  // a página explica o que falta em vez de estourar uma tela de erro.
  if (faixasRes.error?.code === TABELA_INEXISTENTE) {
    return <MigrationPendente />;
  }

  const faixas = (faixasRes.data ?? []) as FaixaComercial[];
  const logs = (logRes.data ?? []) as LogRow[];

  return (
    <div className="min-h-screen bg-ink-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Cabecalho />

        <div className="surface flex items-start gap-3 rounded-2xl p-4 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-volt-300" aria-hidden="true" />
          <div className="space-y-1.5 text-slate-400">
            <p>
              Estes valores são{" "}
              <strong className="text-slate-200">referência interna</strong> para
              apresentação, negociação e proposta. Alterar uma faixa aqui não muda
              contrato, mensalidade nem plano de nenhuma academia.
            </p>
            <p>
              A landing pública exibe apenas{" "}
              <strong className="text-slate-200">
                &ldquo;Planos a partir de {PRECO_MENSAL_LABEL}/mês&rdquo;
              </strong>
              . Esse texto vem de <code className="text-slate-300">lib/site-config.ts</code>{" "}
              e não acompanha automaticamente as faixas abaixo — mudou o valor de
              vitrine, atualize lá também.
            </p>
            <p>
              Acima do teto da última faixa não existe preço de tabela:{" "}
              {MENSAGEM_ACIMA_DA_TABELA}
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="font-semibold text-white">Faixas cadastradas</h2>
          {faixas.length === 0 && (
            <p className="surface rounded-2xl p-5 text-sm text-slate-400">
              Nenhuma faixa cadastrada ainda.
            </p>
          )}
          {faixas.map((f) => (
            <FaixaForm key={f.id} faixa={f} />
          ))}
          <FaixaForm />
        </section>

        <Historico logs={logs} indisponivel={Boolean(logRes.error)} />
      </div>
    </div>
  );
}

function Cabecalho() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Planos e preços</h1>
        <p className="text-sm text-slate-400">
          Configuração comercial · visível somente para o superadministrador
        </p>
      </div>
      <Link
        href="/admin"
        className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-volt-500/40 hover:text-volt-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao admin
      </Link>
    </div>
  );
}

function MigrationPendente() {
  return (
    <div className="min-h-screen bg-ink-950 p-6 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <Cabecalho />
        <div className="surface flex items-start gap-3 rounded-2xl border-amber-500/30 p-5 text-sm">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"
            aria-hidden="true"
          />
          <div className="space-y-2 text-slate-400">
            <p className="font-medium text-white">Migration 056 ainda não aplicada</p>
            <p>
              As tabelas <code className="text-slate-300">faixas_comerciais</code> e{" "}
              <code className="text-slate-300">faixas_comerciais_log</code> não
              existem neste banco. Rode{" "}
              <code className="text-slate-300">
                supabase/migrations/056_faixas_comerciais.sql
              </code>{" "}
              no SQL Editor do Supabase — ela é aditiva e idempotente, não altera
              nenhuma tabela existente.
            </p>
            <p>
              Até lá o resto do sistema segue normal: nenhuma outra tela depende
              destas tabelas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Campos cuja mudança vale a pena mostrar linha a linha no histórico. */
const CAMPOS_AUDITADOS: { chave: string; label: string; moeda?: boolean }[] = [
  { chave: "nome", label: "Nome" },
  { chave: "preco_mensal", label: "Valor mensal", moeda: true },
  { chave: "alunos_min", label: "Mínimo de alunos" },
  { chave: "alunos_max", label: "Máximo de alunos" },
  { chave: "ativo", label: "Ativa" },
  { chave: "publico", label: "Pública" },
  { chave: "disponivel_novos_clientes", label: "Novos clientes" },
  { chave: "ordem", label: "Ordem" },
];

function exibir(valor: unknown, moeda?: boolean): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (moeda) return formatBRL(Number(valor));
  return String(valor);
}

function diferencas(
  anterior: Record<string, unknown> | null,
  novo: Record<string, unknown> | null
): { label: string; de: string; para: string }[] {
  if (!novo) return [];
  return CAMPOS_AUDITADOS.filter(
    (c) => anterior && String(anterior[c.chave]) !== String(novo[c.chave])
  ).map((c) => ({
    label: c.label,
    de: exibir(anterior?.[c.chave], c.moeda),
    para: exibir(novo[c.chave], c.moeda),
  }));
}

function Historico({
  logs,
  indisponivel,
}: {
  logs: LogRow[];
  indisponivel: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-white">Histórico de alterações</h2>
      <p className="text-xs text-slate-500">
        Registro imutável: usuário responsável, data, valor e limites anteriores e
        novos. Últimas 20 alterações.
      </p>

      {indisponivel && (
        <p className="surface rounded-2xl p-5 text-sm text-slate-400">
          Não foi possível carregar o histórico agora.
        </p>
      )}

      {!indisponivel && logs.length === 0 && (
        <p className="surface rounded-2xl p-5 text-sm text-slate-400">
          Nenhuma alteração registrada ainda.
        </p>
      )}

      {logs.length > 0 && (
        <ul className="surface divide-y divide-ink-700/70 overflow-hidden rounded-2xl">
          {logs.map((l) => {
            const mudancas = diferencas(l.valor_anterior, l.valor_novo);
            return (
              <li key={l.id} className="space-y-1.5 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-medium text-white">{l.faixa_nome}</span>
                  <span className="text-xs uppercase tracking-wide text-volt-300">
                    {l.acao}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">
                    {formatDataHoraCompleta(l.registrado_em)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">por {l.usuario_email}</p>
                {mudancas.length > 0 && (
                  <ul className="space-y-0.5 text-xs text-slate-400">
                    {mudancas.map((m) => (
                      <li key={m.label}>
                        {m.label}:{" "}
                        <span className="text-slate-500 line-through">{m.de}</span>{" "}
                        <span className="text-slate-300">{m.para}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {l.motivo && (
                  <p className="text-xs italic text-slate-400">“{l.motivo}”</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
