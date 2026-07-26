"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { GraficoFinanceiroMensal } from "@/components/painel/DashboardCharts";
import Ajuda from "@/components/ui/Ajuda";
import { cn } from "@/lib/utils";
import type { PontoFinanceiroMensal } from "@/lib/types";

/**
 * Gráfico do Financeiro: por padrão mostra só o que já aconteceu — receita,
 * despesa e o resultado de cada período. O saldo projetado fica atrás de um
 * toggle porque mistura dinheiro que entrou com dinheiro que talvez entre, e
 * essa mistura é a principal fonte de confusão na leitura.
 */
export default function GraficoFinanceiro({
  dados,
  periodo,
}: {
  dados: PontoFinanceiroMensal[];
  periodo: string;
}) {
  const [projetado, setProjetado] = useState(false);

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <BarChart3 className="h-4 w-4 text-volt-300" />
            Entradas e saídas
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {periodo} · dinheiro que entrou e saiu de fato
          </p>
        </div>

        <label
          className={cn(
            "no-print flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition",
            projetado
              ? "border-cyanx-500/40 bg-cyanx-500/10 text-cyanx-400"
              : "border-ink-600 bg-ink-800 text-slate-400 hover:border-ink-500"
          )}
        >
          <input
            type="checkbox"
            checked={projetado}
            onChange={(e) => setProjetado(e.target.checked)}
            className="h-3.5 w-3.5 accent-cyanx-400"
          />
          Mostrar saldo projetado
          <Ajuda texto="Soma ao resultado do período o que ainda está pendente e vence dentro dele. É uma estimativa: só acontece se todo mundo pagar." />
        </label>
      </div>

      <div className="mt-3">
        <GraficoFinanceiroMensal dados={dados} mostrarProjetado={projetado} />
      </div>
    </div>
  );
}
