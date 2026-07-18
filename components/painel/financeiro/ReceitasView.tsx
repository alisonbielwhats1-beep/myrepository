"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Pencil, Plus } from "lucide-react";
import { Aluno, Receita, TIPOS_RECEITA } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import { baixarCSV } from "@/lib/csv";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExportBar from "@/components/painel/financeiro/ExportBar";
import {
  atualizarReceita,
  criarReceita,
  excluirReceita,
} from "@/app/painel/[slug]/financeiro/actions";

export default function ReceitasView({
  slug,
  alunos,
  receitas,
}: {
  slug: string;
  alunos: Aluno[];
  receitas: Receita[];
}) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const totalPago = receitas
    .filter((r) => r.status === "pago")
    .reduce((a, r) => a + Number(r.valor), 0);
  const totalPendente = receitas
    .filter((r) => r.status === "pendente")
    .reduce((a, r) => a + Number(r.valor), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">Recebido no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPago)}
          </p>
        </div>
        <div className="surface rounded-2xl p-4">
          <p className="label-muted">A receber no período</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-amber-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(totalPendente)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className={cn("no-print", mostrarForm ? "btn-ghost" : "btn-volt")}
        >
          <Plus className="h-4 w-4" />
          {mostrarForm ? "Fechar formulário" : "Lançar receita"}
        </button>
        <ExportBar
          onExportarCSV={() =>
            baixarCSV(
              "receitas",
              ["Descrição", "Tipo", "Aluno", "Valor", "Data", "Status"],
              receitas.map((r) => [
                r.descricao,
                TIPOS_RECEITA.find((t) => t.value === r.tipo)?.label ?? r.tipo,
                r.aluno?.nome ?? "",
                r.valor,
                r.data,
                r.status === "pago" ? "Pago" : "Pendente",
              ])
            )
          }
        />
      </div>

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
              {receitas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-slate-500">
                    Nenhuma receita neste período.
                  </td>
                </tr>
              )}
              {receitas.map((r) =>
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
                      <p className="font-medium text-white">{r.descricao}</p>
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
                    </td>
                    <td className="px-5 py-3">
                      <div className="no-print flex items-center justify-end gap-1">
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

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  const hoje = new Date().toISOString().slice(0, 10);

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
        <Field label="Descrição">
          <input
            name="descricao"
            defaultValue={receitaExistente?.descricao}
            placeholder="Ex: Mensalidade - Marina Costa"
            className="inp"
            required
          />
        </Field>
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
            defaultValue={receitaExistente?.status ?? "pendente"}
            className="inp"
          >
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
          </select>
        </Field>
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
