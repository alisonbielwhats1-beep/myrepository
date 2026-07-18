"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { CalendarClock, Loader2, Lock, Pencil, Plus } from "lucide-react";
import { CATEGORIAS_DESPESA, Despesa } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import { baixarCSV } from "@/lib/csv";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExportBar from "@/components/painel/financeiro/ExportBar";
import {
  atualizarDespesa,
  criarDespesa,
  excluirDespesa,
  gerarFolha,
} from "@/app/painel/[slug]/financeiro/actions";

export default function DespesasView({
  slug,
  despesas,
  competenciaFolha,
}: {
  slug: string;
  despesas: Despesa[];
  competenciaFolha: string;
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [folhaPending, startFolha] = useTransition();
  const [folhaMsg, setFolhaMsg] = useState<string | null>(null);

  const totalPago = despesas
    .filter((d) => d.status === "pago")
    .reduce((a, d) => a + Number(d.valor), 0);
  const totalPendente = despesas
    .filter((d) => d.status === "pendente")
    .reduce((a, d) => a + Number(d.valor), 0);

  const rodarFolha = () => {
    setFolhaMsg(null);
    startFolha(async () => {
      const r = await gerarFolha(slug, competenciaFolha);
      if (r.erro) setFolhaMsg(r.erro);
      else if (r.criadas === 0)
        setFolhaMsg("Folha deste mês já estava lançada. Nada novo a gerar.");
      else setFolhaMsg(`Folha gerada: ${r.criadas} salário(s) lançado(s).`);
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Pago no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-magenta-400 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPago)}
          </p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">A pagar no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPendente)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="no-print flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMostrarForm((v) => !v)}
            className={mostrarForm ? "btn-ghost" : "btn-volt"}
          >
            <Plus className="h-4 w-4" />
            {mostrarForm ? "Fechar formulário" : "Lançar despesa"}
          </button>
          <button onClick={rodarFolha} disabled={folhaPending} className="btn-ghost">
            {folhaPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
            Gerar folha salarial do mês
          </button>
        </div>
        <ExportBar
          onExportarCSV={() =>
            baixarCSV(
              "despesas",
              ["Descrição", "Categoria", "Valor", "Data", "Status"],
              despesas.map((d) => [
                d.descricao,
                CATEGORIAS_DESPESA.find((c) => c.value === d.categoria)?.label ??
                  d.categoria,
                d.valor,
                d.data,
                d.status === "pago" ? "Pago" : "Pendente",
              ])
            )
          }
        />
      </div>

      {folhaMsg && (
        <p className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-sm text-slate-300">
          {folhaMsg}
        </p>
      )}

      {mostrarForm && (
        <FormularioDespesa
          slug={slug}
          onCancelar={() => setMostrarForm(false)}
          onSalvo={() => setMostrarForm(false)}
        />
      )}

      <div className="surface overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Descrição</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="no-print px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {despesas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-slate-500">
                    Nenhuma despesa neste período.
                  </td>
                </tr>
              )}
              {despesas.map((d) => {
                const ehSalario = !!d.funcionario_id;
                return editandoId === d.id ? (
                  <tr key={d.id}>
                    <td colSpan={6} className="p-4">
                      <FormularioDespesa
                        slug={slug}
                        despesaExistente={d}
                        onCancelar={() => setEditandoId(null)}
                        onSalvo={() => setEditandoId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id} className="hover:bg-ink-700/30">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2 font-medium text-white">
                        {d.descricao}
                        {ehSalario && (
                          <span className="chip border-ink-600 bg-ink-700 text-[10px] text-slate-400">
                            <Lock className="h-3 w-3" /> folha
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-300">
                      {CATEGORIAS_DESPESA.find((c) => c.value === d.categoria)?.label}
                    </td>
                    <td className="px-5 py-3 font-medium text-white">
                      {formatBRL(d.valor)}
                    </td>
                    <td className="px-5 py-3 text-slate-400">
                      {new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <StatusChip status={d.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="no-print flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditandoId(d.id)}
                          title="Editar despesa"
                          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-ink-700 hover:text-white"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <ConfirmButton
                          action={() => excluirDespesa(slug, d.id)}
                          confirmText={`Excluir a despesa "${d.descricao}"?`}
                          label="Excluir despesa"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FormularioDespesa({
  slug,
  despesaExistente,
  onCancelar,
  onSalvo,
}: {
  slug: string;
  despesaExistente?: Despesa;
  onCancelar?: () => void;
  onSalvo: () => void;
}) {
  const acao = despesaExistente
    ? atualizarDespesa.bind(null, slug, despesaExistente.id)
    : criarDespesa.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h3 className="font-semibold text-white">
        {despesaExistente ? "Editar despesa" : "Nova despesa"}
      </h3>
      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Descrição">
          <input
            name="descricao"
            defaultValue={despesaExistente?.descricao}
            placeholder="Ex: Conta de energia"
            className="inp"
            required
          />
        </Field>
        <Field label="Categoria">
          <select
            name="categoria"
            defaultValue={despesaExistente?.categoria ?? "outros"}
            className="inp"
          >
            {CATEGORIAS_DESPESA.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor (R$)">
          <input
            name="valor"
            type="number"
            min={0}
            step="0.01"
            defaultValue={despesaExistente?.valor ?? ""}
            className="inp"
            required
          />
        </Field>
        <Field label="Data">
          <input
            name="data"
            type="date"
            defaultValue={despesaExistente?.data ?? hoje}
            className="inp"
            required
          />
        </Field>
        <Field label="Status">
          <select
            name="status"
            defaultValue={despesaExistente?.status ?? "pendente"}
            className="inp"
          >
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </Field>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Observações
          </span>
          <textarea
            name="observacoes"
            defaultValue={despesaExistente?.observacoes ?? ""}
            rows={1}
            className="inp"
          />
        </label>
      </div>
      <FormActions
        onCancelar={onCancelar}
        salvarLabel={despesaExistente ? "Salvar alterações" : "Lançar despesa"}
        className="mt-4"
      />
    </form>
  );
}

function StatusChip({ status }: { status: "pago" | "pendente" }) {
  return (
    <span
      className={cn(
        "chip",
        status === "pago"
          ? "border-volt-500/30 bg-volt-500/10 text-volt-300"
          : "border-amber-500/30 bg-amber-500/10 text-amber-300"
      )}
    >
      {status === "pago" ? "Pago" : "Pendente"}
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
