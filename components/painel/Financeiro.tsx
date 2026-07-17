"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Clock,
  Pencil,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import { GraficoFinanceiroMensal, PontoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import {
  Aluno,
  CATEGORIAS_DESPESA,
  Despesa,
  Receita,
  TIPOS_RECEITA,
} from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";
import { KpisFinanceiro } from "@/lib/financeiro";
import {
  atualizarDespesa,
  atualizarReceita,
  criarDespesa,
  criarReceita,
  excluirDespesa,
  excluirReceita,
} from "@/app/painel/[slug]/financeiro/actions";

export default function Financeiro({
  slug,
  alunos,
  receitas,
  despesas,
  kpis,
  dadosMensais,
}: {
  slug: string;
  alunos: Aluno[];
  receitas: Receita[];
  despesas: Despesa[];
  kpis: KpisFinanceiro;
  dadosMensais: PontoFinanceiroMensal[];
}) {
  const [aba, setAba] = useState<"receitas" | "despesas">("receitas");

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={ArrowUpCircle}
          label="Receita do mês"
          value={formatBRL(kpis.receitaMes)}
          hint="Pagas neste mês"
          accent="volt"
        />
        <StatTile
          icon={ArrowDownCircle}
          label="Despesa do mês"
          value={formatBRL(kpis.despesaMes)}
          hint="Pagas neste mês"
          accent="magenta"
        />
        <StatTile
          icon={Scale}
          label="Lucro do mês"
          value={formatBRL(kpis.lucroMes)}
          hint="Receita - despesa"
          accent={kpis.lucroMes >= 0 ? "volt" : "magenta"}
        />
        <StatTile
          icon={Wallet}
          label="Fluxo de caixa"
          value={formatBRL(kpis.fluxoCaixa)}
          hint="Acumulado (pagos)"
          accent="cyan"
        />
      </div>

      {/* Pendências */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <Clock className="h-5 w-5 flex-none text-amber-400" />
          <div>
            <p className="text-sm text-slate-300">Receitas pendentes</p>
            <p className="font-semibold text-white">
              {formatBRL(kpis.receitasPendentes)}
            </p>
          </div>
        </div>
        <div className="surface flex items-center gap-3 rounded-2xl p-4">
          <Clock className="h-5 w-5 flex-none text-amber-400" />
          <div>
            <p className="text-sm text-slate-300">Despesas pendentes</p>
            <p className="font-semibold text-white">
              {formatBRL(kpis.despesasPendentes)}
            </p>
          </div>
        </div>
      </div>

      {/* Gráfico mensal */}
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Receita x Despesa (mensal)</h2>
        </div>
        <p className="mb-2 text-xs text-slate-500">Últimos 6 meses, valores pagos</p>
        <GraficoFinanceiroMensal dados={dadosMensais} />
      </div>

      {/* Abas Receitas / Despesas */}
      <div className="flex gap-2">
        <button
          onClick={() => setAba("receitas")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            aba === "receitas"
              ? "bg-volt-300 text-ink-950"
              : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
          )}
        >
          Receitas
        </button>
        <button
          onClick={() => setAba("despesas")}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-semibold transition",
            aba === "despesas"
              ? "bg-volt-300 text-ink-950"
              : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
          )}
        >
          Despesas
        </button>
      </div>

      {aba === "receitas" ? (
        <PainelReceitas slug={slug} alunos={alunos} receitas={receitas} />
      ) : (
        <PainelDespesas slug={slug} despesas={despesas} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Receitas
// ---------------------------------------------------------------------------
function PainelReceitas({
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

  return (
    <div className="space-y-4">
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className={mostrarForm ? "btn-ghost" : "btn-volt"}
      >
        <Plus className="h-4 w-4" />
        {mostrarForm ? "Fechar formulário" : "Lançar receita"}
      </button>

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
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {receitas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-slate-500">
                    Nenhuma receita lançada ainda.
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
                      <div className="flex items-center justify-end gap-1">
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

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------
function PainelDespesas({ slug, despesas }: { slug: string; despesas: Despesa[] }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className={mostrarForm ? "btn-ghost" : "btn-volt"}
      >
        <Plus className="h-4 w-4" />
        {mostrarForm ? "Fechar formulário" : "Lançar despesa"}
      </button>

      {mostrarForm && (
        <FormularioDespesa
          slug={slug}
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
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Valor</th>
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {despesas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-slate-500">
                    Nenhuma despesa lançada ainda.
                  </td>
                </tr>
              )}
              {despesas.map((d) =>
                editandoId === d.id ? (
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
                    <td className="px-5 py-3 font-medium text-white">
                      {d.descricao}
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
                      <div className="flex items-center justify-end gap-1">
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
                )
              )}
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

// ---------------------------------------------------------------------------
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
