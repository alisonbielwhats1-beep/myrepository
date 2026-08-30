"use client";

import { useState } from "react";
import { ArrowLeftRight, Wallet } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";

/**
 * Caixa × Competência em abas (auditoria de UX, item 7). Caixa (dinheiro que
 * passou pela conta) e Competência/DRE (o que a academia gerou no período) são
 * duas perguntas diferentes com números parecidos — antes conviviam soltas na
 * mesma tela e a diferença ficava num tooltip longo. Aqui viram duas abas com
 * um único card de resultado cada, e uma faixa que liga as duas visões com
 * número. Só apresentação: os valores vêm prontos do servidor (lib/financeiro).
 */

type Aba = "caixa" | "competencia";

export default function ResumoCaixaCompetencia({
  periodo,
  receitaRecebida,
  despesaPaga,
  resultado,
  saldoRegistrado,
  saldoDesde,
  compReceita,
  compRecebida,
  compAReceber,
  compDespesa,
  compAPagar,
  compLucro,
  compMargem,
}: {
  periodo: string;
  receitaRecebida: number;
  despesaPaga: number;
  resultado: number;
  saldoRegistrado: number;
  saldoDesde: string | null;
  compReceita: number;
  compRecebida: number;
  compAReceber: number;
  compDespesa: number;
  compAPagar: number;
  compLucro: number;
  compMargem: number;
}) {
  const [aba, setAba] = useState<Aba>("caixa");

  return (
    <section className="space-y-3">
      {/* Abas segmentadas */}
      <div
        className="surface inline-flex gap-1 rounded-xl p-1"
        role="tablist"
        aria-label="Visão financeira"
      >
        <BotaoAba ativo={aba === "caixa"} onClick={() => setAba("caixa")}>
          Caixa <span className="hidden sm:inline">· dinheiro real</span>
        </BotaoAba>
        <BotaoAba ativo={aba === "competencia"} onClick={() => setAba("competencia")}>
          Competência <span className="hidden sm:inline">· DRE</span>
        </BotaoAba>
      </div>

      {/* Card de resultado da aba */}
      {aba === "caixa" ? (
        <div className="surface rounded-2xl p-5">
          <p className="text-sm text-slate-400">
            Dinheiro que passou pelo caixa · <span className="capitalize">{periodo}</span>
          </p>
          <dl className="mt-3 space-y-2.5">
            <Linha rotulo="Receita recebida" valor={receitaRecebida} cor="volt" />
            <Linha rotulo="Despesa paga" valor={-despesaPaga} cor="red" />
            <Total rotulo="Resultado do período" valor={resultado} />
          </dl>
          <p className="mt-4 flex items-center gap-2 border-t border-ink-700 pt-3 text-xs text-slate-500">
            <Wallet className="h-3.5 w-3.5 text-slate-500" />
            Saldo registrado no GestAcad: {formatBRL(saldoRegistrado)}
            {saldoDesde && (
              <> · desde {new Date(saldoDesde + "T00:00:00").toLocaleDateString("pt-BR")}</>
            )}
          </p>
        </div>
      ) : (
        <div className="surface rounded-2xl p-5">
          <p className="text-sm text-slate-400">
            Resultado gerado no período (DRE) ·{" "}
            <span className="capitalize">{periodo}</span>
          </p>
          <dl className="mt-3 space-y-2.5">
            <Linha rotulo="Receita gerada" valor={compReceita} cor="branco" />
            <Linha rotulo="— já recebida" valor={compRecebida} cor="volt" recuo />
            <Linha rotulo="— ainda a receber" valor={compAReceber} cor="amber" recuo />
            <Linha rotulo="Despesa gerada" valor={-compDespesa} cor="red" />
            <Total
              rotulo="Lucro"
              valor={compLucro}
              sufixo={`margem ${compMargem.toFixed(0)}%`}
            />
          </dl>
        </div>
      )}

      {/* Faixa de insight ligando as duas visões com número */}
      {(compAReceber > 0 || compAPagar > 0) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-volt-500/30 bg-volt-300/[0.07] px-4 py-3 text-xs text-volt-300">
          <ArrowLeftRight className="mt-0.5 h-4 w-4 flex-none" />
          <p className="leading-relaxed">
            A diferença entre as duas visões:{" "}
            {compAReceber > 0 && (
              <b className="font-semibold">
                {formatBRL(compAReceber)} gerado que ainda não entrou no caixa
              </b>
            )}
            {compAReceber > 0 && compAPagar > 0 && " e "}
            {compAPagar > 0 && (
              <b className="font-semibold">
                {formatBRL(compAPagar)} gasto que ainda não saiu
              </b>
            )}
            . Por isso o caixa e o lucro do período não batem.
          </p>
        </div>
      )}
    </section>
  );
}

function BotaoAba({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativo}
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
        ativo ? "bg-volt-300 text-ink-950" : "text-slate-400 hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}

const COR_VALOR = {
  volt: "text-volt-300",
  red: "text-red-400",
  amber: "text-amber-300",
  branco: "text-white",
} as const;

function Linha({
  rotulo,
  valor,
  cor,
  recuo = false,
}: {
  rotulo: string;
  valor: number;
  cor: keyof typeof COR_VALOR;
  recuo?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className={cn("text-slate-300", recuo && "pl-3.5 text-slate-400")}>
        {rotulo}
      </dt>
      <dd className={cn("tabular-nums font-medium", COR_VALOR[cor])}>
        {formatBRL(valor)}
      </dd>
    </div>
  );
}

function Total({
  rotulo,
  valor,
  sufixo,
}: {
  rotulo: string;
  valor: number;
  sufixo?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-ink-700 pt-2.5">
      <dt className="text-sm font-semibold text-slate-200">
        {rotulo}
        {sufixo && (
          <span className="ml-2 text-xs font-normal text-slate-500">{sufixo}</span>
        )}
      </dt>
      <dd
        className={cn(
          "text-2xl font-extrabold tabular-nums",
          valor >= 0 ? "text-volt-300" : "text-red-400"
        )}
      >
        {formatBRL(valor)}
      </dd>
    </div>
  );
}
