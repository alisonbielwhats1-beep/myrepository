"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarClock, Check, FilterX, Loader2, Pencil, Plus } from "lucide-react";
import { Aluno, FORMAS_PAGAMENTO, Receita, TIPOS_RECEITA } from "@/lib/types";
import { cn, formatBRL, hojeSaoPaulo } from "@/lib/utils";
import { baixarCSV } from "@/lib/csv";
import Ajuda from "@/components/ui/Ajuda";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExportBar from "@/components/painel/financeiro/ExportBar";
import {
  atualizarReceita,
  criarReceita,
  excluirReceita,
  previewCobrancasMensais,
  registrarPagamentoRetroativo,
  sincronizarCobrancas,
  type PreviaCobrancas,
} from "@/app/painel/[slug]/financeiro/actions";

export default function ReceitasView({
  slug,
  alunos,
  receitas,
  alunoIdInicial,
  statusInicial,
  pagamentoInicial,
  tipoInicial,
  buscaInicial,
}: {
  slug: string;
  alunos: Aluno[];
  receitas: Receita[];
  alunoIdInicial?: string;
  statusInicial?: string;
  pagamentoInicial?: string;
  tipoInicial?: string;
  buscaInicial?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mensPending, startMens] = useTransition();

  // Busca inicial: nome do aluno vindo da ficha, ou o texto livre da URL.
  const nomeInicial = alunoIdInicial
    ? (alunos.find((a) => a.id === alunoIdInicial)?.nome ?? "")
    : (buscaInicial ?? "");

  const [busca, setBusca] = useState(nomeInicial);
  const [status, setStatus] = useState(statusInicial ?? "todos");
  const [pagamento, setPagamento] = useState(pagamentoInicial ?? "todas");
  const [tipo, setTipo] = useState(tipoInicial ?? "todos");
  const [confirmando, setConfirmando] = useState(false);
  const [previa, setPrevia] = useState<PreviaCobrancas | null>(null);
  const [mensMsg, setMensMsg] = useState<string | null>(null);

  // Competência alvo = mês de referência do período selecionado, para o botão
  // gerar a mesma competência que o usuário está olhando.
  const refPeriodo = searchParams.get("ref") ?? searchParams.get("de") ?? hojeSaoPaulo();
  const competenciaAlvo = `${refPeriodo.slice(0, 7)}-01`;
  const nomeCompetencia = new Date(competenciaAlvo + "T00:00:00").toLocaleDateString(
    "pt-BR",
    { month: "long", year: "numeric" }
  );

  /** Mantém os filtros na URL para sobreviverem à navegação entre abas. */
  const sincronizarUrl = (patch: Record<string, string>) => {
    const p = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || v === "todos" || v === "todas") p.delete(k);
      else p.set(k, v);
    }
    p.delete("aluno"); // a partir da 1ª interação, a busca livre assume
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const filtrosAtivos =
    busca.trim() !== "" || status !== "todos" || pagamento !== "todas" || tipo !== "todos";

  const limparFiltros = () => {
    setBusca("");
    setStatus("todos");
    setPagamento("todas");
    setTipo("todos");
    sincronizarUrl({ q: "", status: "", pagamento: "", tipo: "" });
  };

  const abrirConfirmacao = () => {
    setMensMsg(null);
    setConfirmando(true);
    setPrevia(null);
    startMens(async () => {
      setPrevia(await previewCobrancasMensais(slug, competenciaAlvo));
    });
  };

  const confirmarGeracao = () => {
    startMens(async () => {
      const r = await sincronizarCobrancas(slug);
      setConfirmando(false);
      if (r.erro) {
        setMensMsg(r.erro);
        return;
      }
      const partes = [`${r.criadas ?? 0} cobrança(s) criada(s)`];
      if (r.jaExistiam) partes.push(`${r.jaExistiam} já existia(m)`);
      partes.push(`${r.alunosElegiveis ?? 0} aluno(s) elegível(is)`);
      setMensMsg(`${partes.join(" · ")}.`);
    });
  };

  const termo = busca.trim().toLowerCase();
  const receitasFiltradas = receitas.filter((r) => {
    if (status !== "todos" && r.status !== status) return false;
    if (pagamento === "com_data" && !r.data_pagamento) return false;
    if (pagamento === "sem_data" && r.data_pagamento) return false;
    if (tipo !== "todos" && r.tipo !== tipo) return false;
    if (termo) {
      const alvo = `${r.aluno?.nome ?? ""} ${r.descricao ?? ""}`.toLowerCase();
      if (!alvo.includes(termo)) return false;
    }
    return true;
  });

  const totalPago = receitasFiltradas
    .filter((r) => r.status === "pago")
    .reduce((a, r) => a + Number(r.valor), 0);
  const totalPendente = receitasFiltradas
    .filter((r) => r.status === "pendente")
    .reduce((a, r) => a + Number(r.valor), 0);

  const corrigindoHistorico = status === "pago" && pagamento === "sem_data";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Recebido no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPago, { compacto: true })}
          </p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">A receber no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPendente, { compacto: true })}
          </p>
        </div>
      </div>

      {/* Filtros combináveis */}
      <div className="no-print surface rounded-2xl p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Buscar</span>
            <input
              type="search"
              placeholder="Aluno ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onBlur={() => sincronizarUrl({ q: busca })}
              className="inp"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); sincronizarUrl({ status: e.target.value }); }}
              className="inp"
            >
              <option value="todos">Todos</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="cancelada">Cancelado</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Pagamento</span>
            <select
              value={pagamento}
              onChange={(e) => { setPagamento(e.target.value); sincronizarUrl({ pagamento: e.target.value }); }}
              className="inp"
            >
              <option value="todas">Todas</option>
              <option value="com_data">Com data de pagamento</option>
              <option value="sem_data">Sem data de pagamento</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => { setTipo(e.target.value); sincronizarUrl({ tipo: e.target.value }); }}
              className="inp"
            >
              <option value="todos">Todos</option>
              {TIPOS_RECEITA.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-400">
            <b className="text-white">{receitasFiltradas.length}</b> de {receitas.length}{" "}
            lançamento(s) no período
          </span>
          {filtrosAtivos && (
            <button onClick={limparFiltros} className="btn-ghost h-8 px-3 text-xs">
              <FilterX className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>

        {corrigindoHistorico && receitasFiltradas.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Estes lançamentos estão pagos mas sem data de pagamento, então não entram
            no dinheiro realizado. Informe a data e a forma direto na linha — valor,
            competência e vencimento não são alterados.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className={mostrarForm ? "btn-ghost" : "btn-volt"}
          >
            <Plus className="h-4 w-4" />
            {mostrarForm ? "Fechar formulário" : "Lançar receita"}
          </button>
          <span className="inline-flex items-center gap-1">
            <button onClick={abrirConfirmacao} disabled={mensPending} className="btn-ghost">
              {mensPending && !confirmando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Sincronizar cobranças
            </button>
            <Ajuda texto="Cria as cobranças pendentes que vencem nos próximos 7 dias, para os alunos com plano ativo e cobrança recorrente. Roda sozinho uma vez por dia; este botão apenas antecipa. Cobranças já existentes não são duplicadas e nada é cobrado automaticamente." />
          </span>
        </div>
        <ExportBar
          onExportarCSV={() =>
            baixarCSV(
              "receitas",
              [
                "Descrição", "Tipo", "Aluno", "Valor", "Vencimento",
                "Competência", "Status", "Data do pagamento", "Forma de pagamento",
              ],
              // Exporta exatamente o que a tabela mostra — o filtro por aluno
              // e o período selecionado valem também para o CSV.
              receitasFiltradas.map((r) => [
                r.descricao,
                TIPOS_RECEITA.find((t) => t.value === r.tipo)?.label ?? r.tipo,
                r.aluno?.nome ?? "",
                r.valor,
                r.data,
                r.competencia ?? "",
                r.status === "pago" ? "Pago" : r.status === "cancelada" ? "Cancelada" : "Pendente",
                r.data_pagamento ?? "",
                r.forma_pagamento ?? "",
              ])
            )
          }
        />
      </div>

      {confirmando && (
        <div className="no-print surface rounded-2xl border border-volt-500/30 p-5">
          <h3 className="font-semibold text-white">
            Sincronizar cobranças dos alunos com plano ativo?
          </h3>
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            <li>
              Cria as cobranças que vencem{" "}
              <b className="text-slate-200">nos próximos 7 dias</b>.
            </li>
            {previa ? (
              <li>
                Alunos com plano de cobrança recorrente:{" "}
                <b className="text-slate-200">{previa.comPlanoAtivo}</b>
              </li>
            ) : (
              <li className="flex items-center gap-1.5 text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" /> Calculando alunos
                elegíveis...
              </li>
            )}
            <li className="text-slate-500">
              Planos trimestrais, semestrais e anuais só geram cobrança no mês em que
              o ciclo fecha, então o número final pode ser menor.
            </li>
            <li className="text-slate-500">
              Isso roda sozinho uma vez por dia — o botão só antecipa. Cobranças
              existentes não são duplicadas e nada é cobrado do aluno
              automaticamente.
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setConfirmando(false)}
              disabled={mensPending}
              className="btn-ghost"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarGeracao}
              disabled={mensPending || !previa}
              className="btn-volt"
            >
              {mensPending && previa ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarClock className="h-4 w-4" />
              )}
              Gerar cobranças
            </button>
          </div>
        </div>
      )}

      {mensMsg && (
        <p className="no-print rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-300">
          {mensMsg}
        </p>
      )}

      {mostrarForm && (
        <FormularioReceita
          slug={slug}
          alunos={alunos}
          onCancelar={() => setMostrarForm(false)}
          onSalvo={() => setMostrarForm(false)}
        />
      )}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="no-print px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {receitasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-slate-500">
                    {filtrosAtivos
                      ? "Nenhuma receita encontrada com esses filtros."
                      : "Nenhuma receita neste período."}
                  </td>
                </tr>
              )}
              {receitasFiltradas.map((r) =>
                editandoId === r.id ? (
                  <tr key={r.id}>
                    <td colSpan={6} className="p-4">
                      <FormularioReceita
                        slug={slug}
                        alunos={alunos}
                        receitaExistente={r}
                        onCancelar={() => setEditandoId(null)}
                        onSalvo={() => setEditandoId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="hover:bg-ink-700/30">
                    <td className="px-5 py-3">
                      <p className="font-medium text-white">
                        {r.descricao || TIPOS_RECEITA.find((t) => t.value === r.tipo)?.label || r.tipo}
                      </p>
                      {r.aluno?.nome && (
                        <p className="text-xs text-slate-500">{r.aluno.nome}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {TIPOS_RECEITA.find((t) => t.value === r.tipo)?.label}
                    </td>
                    <td className="px-5 py-3 font-medium text-white">
                      {formatBRL(r.valor)}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <StatusChip status={r.status} />
                      {r.data_pagamento && (
                        <span className="mt-0.5 block text-[10px] text-volt-300/70">
                          {new Date(r.data_pagamento + "T00:00:00").toLocaleDateString("pt-BR")}
                          {r.forma_pagamento && ` · ${r.forma_pagamento}`}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="no-print flex items-center justify-end gap-1">
                        {corrigindoHistorico && (
                          <PagamentoRapido slug={slug} receitaId={r.id} />
                        )}
                        <button
                          onClick={() => setEditandoId(r.id)}
                          title="Editar receita"
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmButton
                          action={() => excluirReceita(slug, r.id)}
                          confirmText={`Excluir a receita "${r.descricao}"?`}
                          label="Excluir receita"
                        />
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * Preenche data e forma de pagamento de um lançamento já pago, sem abrir o
 * formulário completo. Valor, competência, vencimento e status ficam intactos.
 */
function PagamentoRapido({ slug, receitaId }: { slug: string; receitaId: string }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hojeSaoPaulo());
  const [forma, setForma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-md bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-300 transition hover:bg-amber-500/25"
      >
        Informar pagamento
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {erro && <span className="text-[10px] text-red-400">{erro}</span>}
      <input
        type="date"
        value={data}
        max={hojeSaoPaulo()}
        onChange={(e) => setData(e.target.value)}
        className="h-7 rounded border border-ink-600 bg-ink-900 px-1 text-[10px] text-slate-200"
      />
      <select
        value={forma}
        onChange={(e) => setForma(e.target.value)}
        className="h-7 rounded border border-ink-600 bg-ink-900 px-1 text-[10px] text-slate-200"
      >
        <option value="">Forma…</option>
        {FORMAS_PAGAMENTO.map((f) => (
          <option key={f.value} value={f.label}>{f.label}</option>
        ))}
      </select>
      <button
        disabled={pending || !data}
        onClick={() =>
          start(async () => {
            setErro(null);
            const r = await registrarPagamentoRetroativo(
              slug, "receitas", receitaId, data, forma
            );
            if (r.erro) setErro(r.erro);
            else setAberto(false);
          })
        }
        title="Salvar pagamento"
        className="grid h-7 w-7 place-items-center rounded bg-volt-500/15 text-volt-300 transition hover:bg-volt-500/25 disabled:opacity-40"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      </button>
      <button
        onClick={() => { setAberto(false); setErro(null); }}
        className="grid h-7 w-7 place-items-center rounded text-slate-500 hover:text-slate-300"
        title="Fechar"
      >
        ✕
      </button>
    </div>
  );
}

function FormularioReceita({
  slug,
  alunos,
  receitaExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  alunos: Aluno[];
  receitaExistente?: Receita;
  onCancelar?: () => void;
  onSalvo: () => void;
}) {
  const acao = receitaExistente
    ? atualizarReceita.bind(null, slug, receitaExistente.id)
    : criarReceita.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [status, setStatus] = useState<string>(receitaExistente?.status ?? "pendente");

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const hoje = hojeSaoPaulo();

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h3 className="font-semibold text-white">
        {receitaExistente ? "Editar receita" : "Nova receita"}
      </h3>
      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Tipo">
          <select
            name="tipo"
            defaultValue={receitaExistente?.tipo ?? "mensalidade"}
            className="inp"
          >
            {TIPOS_RECEITA.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descrição (opcional)">
          <input
            name="descricao"
            defaultValue={receitaExistente?.descricao ?? ""}
            placeholder="Ex: Marina Costa"
            className="inp"
          />
        </Field>
        <Field label="Valor (R$)">
          <input
            name="valor"
            type="number"
            min={0}
            step="0.01"
            defaultValue={receitaExistente?.valor ?? ""}
            className="inp"
            required
          />
        </Field>
        <Field label="Data">
          <input
            name="data"
            type="date"
            defaultValue={receitaExistente?.data ?? hoje}
            className="inp"
            required
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="inp"
          >
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </Field>
        {status === "pago" && (
          <>
            <Field label="Forma de pagamento">
              <select
                name="forma_pagamento"
                defaultValue={receitaExistente?.forma_pagamento ?? ""}
                className="inp"
              >
                <option value="">—</option>
                {FORMAS_PAGAMENTO.map((f) => (
                  <option key={f.value} value={f.label}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data do pagamento">
              <input
                name="data_pagamento"
                type="date"
                defaultValue={receitaExistente?.data_pagamento ?? hoje}
                className="inp"
              />
            </Field>
          </>
        )}
        <Field label="Aluno (opcional)">
          <select
            name="aluno_id"
            defaultValue={receitaExistente?.aluno_id ?? ""}
            className="inp"
          >
            <option value="">—</option>
            {alunos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </select>
        </Field>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Observações
          </span>
          <textarea
            name="observacoes"
            defaultValue={receitaExistente?.observacoes ?? ""}
            rows={2}
            className="inp"
          />
        </label>
      </div>
      <FormActions
        onCancelar={onCancelar}
        salvarLabel={receitaExistente ? "Salvar alterações" : "Lançar receita"}
        className="mt-4"
      />
    </form>
  );
}

function StatusChip({ status }: { status: "pago" | "pendente" | "cancelada" }) {
  return (
    <span
      className={cn(
        "chip",
        status === "pago"
          ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
          : status === "cancelada"
          ? "border-slate-500/30 bg-slate-500/10 text-slate-500"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      )}
    >
      {status === "pago" ? "Pago" : status === "cancelada" ? "Cancelada" : "Pendente"}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
