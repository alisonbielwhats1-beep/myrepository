import { FileText } from "lucide-react";
import Ajuda from "@/components/ui/Ajuda";
import { DRE } from "@/lib/financeiro";
import {
  CATEGORIAS_DESPESA,
  TIPOS_RECEITA,
} from "@/lib/types";
import { formatBRL } from "@/lib/utils";

/** Demonstrativo simples: receita por tipo x despesa por categoria + lucro. */
export default function DREResumo({ dre, periodo }: { dre: DRE; periodo: string }) {
  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-volt-300" />
        <h2 className="font-semibold text-white">Resultado do período</h2>
        <Ajuda texto="Também chamado de DRE ou regime de competência. Enquanto os cards do topo mostram o dinheiro que passou pelo caixa, aqui cada valor é contado no mês a que se refere — a mensalidade de julho conta em julho, mesmo se o aluno pagar em agosto ou ainda não tiver pago. Lançamentos cancelados ficam de fora." />
      </div>
      <p className="mb-3 text-xs text-slate-500">
        <span className="capitalize">{periodo}</span> · o que a academia{" "}
        <b className="text-slate-400">gerou</b> no período, mesmo que ainda não
        tenha entrado no caixa.{" "}
        <span className="text-slate-600">
          Não é o dinheiro disponível — para isso, veja o saldo registrado.
        </span>
        {dre.semCompetencia > 0 && (
          <>
            {" "}
            <span className="text-amber-300/80">
              {dre.semCompetencia} lançamento(s) antigo(s) sem mês de referência
              foram contados pela data do lançamento.
            </span>
          </>
        )}
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2 text-xs">
          <p className="text-slate-400">
            Receita do período:{" "}
            <b className="text-white">{formatBRL(dre.totalReceita)}</b>
          </p>
          <p className="mt-0.5 text-slate-500">
            <span className="text-volt-300">{formatBRL(dre.receitaRecebida)}</span> já
            recebeu ·{" "}
            <span className="text-amber-300">{formatBRL(dre.receitaAReceber)}</span>{" "}
            ainda vai receber
          </p>
        </div>
        <div className="rounded-xl border border-ink-600 bg-ink-900/40 px-3 py-2 text-xs">
          <p className="text-slate-400">
            Despesa do período:{" "}
            <b className="text-white">{formatBRL(dre.totalDespesa)}</b>
          </p>
          <p className="mt-0.5 text-slate-500">
            <span className="text-red-400">{formatBRL(dre.despesaPaga)}</span> já
            pagou ·{" "}
            <span className="text-amber-300">{formatBRL(dre.despesaAPagar)}</span>{" "}
            ainda vai pagar
          </p>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Receitas por tipo */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-volt-300">
            Receitas
          </p>
          {dre.receitasPorTipo.length === 0 ? (
            <p className="text-sm text-slate-500">Sem receitas no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {dre.receitasPorTipo.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300">
                    {TIPOS_RECEITA.find((t) => t.value === l.chave)?.label ?? l.chave}
                  </span>
                  <span className="tabular-nums font-medium text-white">
                    {formatBRL(l.total)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-ink-700 pt-1.5 text-sm font-semibold">
                <span className="text-slate-200">Total</span>
                <span className="tabular-nums text-volt-300">
                  {formatBRL(dre.totalReceita)}
                </span>
              </li>
            </ul>
          )}
        </div>

        {/* Despesas por categoria */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-400">
            Despesas
          </p>
          {dre.despesasPorCategoria.length === 0 ? (
            <p className="text-sm text-slate-500">Sem despesas no período.</p>
          ) : (
            <ul className="space-y-1.5">
              {dre.despesasPorCategoria.map((l) => (
                <li key={l.chave} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-slate-300">
                    {CATEGORIAS_DESPESA.find((c) => c.value === l.chave)?.label ?? l.chave}
                  </span>
                  <span className="tabular-nums font-medium text-white">
                    {formatBRL(l.total)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2 border-t border-ink-700 pt-1.5 text-sm font-semibold">
                <span className="text-slate-200">Total</span>
                <span className="tabular-nums text-red-400">
                  {formatBRL(dre.totalDespesa)}
                </span>
              </li>
            </ul>
          )}
        </div>
      </div>

      {/* Lucro / margem */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-600 bg-ink-900/40 p-4">
        <span className="text-sm font-medium text-slate-300">
          Resultado gerado no período
          <span className="mt-0.5 block text-xs font-normal text-slate-500">
            Receita gerada menos despesa gerada. Pode incluir valores ainda não
            recebidos ou não pagos.
          </span>
        </span>
        <div className="flex items-baseline gap-3">
          <span
            className={cnLucro(dre.lucro)}
          >
            {formatBRL(dre.lucro, { compacto: true })}
          </span>
          <span className="text-xs text-slate-500">
            margem {dre.margem.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function cnLucro(lucro: number): string {
  return `tabular-nums text-xl font-bold ${
    lucro >= 0 ? "text-volt-300" : "text-red-400"
  }`;
}
