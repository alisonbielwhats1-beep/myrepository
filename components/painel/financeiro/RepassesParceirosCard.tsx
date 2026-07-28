import { Handshake } from "lucide-react";
import Ajuda from "@/components/ui/Ajuda";
import { formatBRL } from "@/lib/utils";
import type { LinhaRepasseParceiro } from "@/lib/data";

const NOMES: Record<LinhaRepasseParceiro["plataforma"], string> = {
  gympass: "Gympass/Wellhub",
  totalpass: "TotalPass",
};

/**
 * Repasse ESTIMADO de parceiros (TotalPass/Gympass) no período — nunca soma
 * em Receita recebida, Caixa, Saldo, Lucro, Meta de faturamento ou
 * Faturamento confirmado. Usa o valor histórico gravado em cada check-in
 * (migration 049) — não recalcula o período com o valor configurado hoje.
 */
export default function RepassesParceirosCard({
  linhas,
  periodo,
}: {
  linhas: LinhaRepasseParceiro[];
  periodo: string;
}) {
  const total = linhas.reduce((acc, l) => acc + Number(l.valor_estimado_total), 0);
  const totalCheckins = linhas.reduce((acc, l) => acc + Number(l.checkins_validos), 0);

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <Handshake className="h-4 w-4 text-volt-300" />
            Repasses estimados de parceiros
            <Ajuda texto="Estimativa baseada nos check-ins registrados e no valor por check-in configurado em Integrações — não é dinheiro confirmado nem entra em Receita, Caixa, Saldo, Lucro ou Meta de faturamento." />
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {periodo} · TotalPass e Gympass/Wellhub, separado do faturamento confirmado
          </p>
        </div>
        {totalCheckins > 0 && (
          <p className="shrink-0 text-right">
            <span className="block text-sm font-bold tabular-nums text-white">
              {formatBRL(total, { compacto: true })}
            </span>
            <span className="block text-xs text-slate-500">estimado no período</span>
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {linhas.map((l) => (
          <div
            key={l.plataforma}
            className="rounded-lg border border-ink-700 bg-ink-800/50 p-3.5"
          >
            <p className="text-sm font-medium text-white">{NOMES[l.plataforma]}</p>
            <p className="mt-2 text-lg font-bold tabular-nums text-volt-300">
              {formatBRL(Number(l.valor_estimado_total), { compacto: true })}
            </p>
            <p className="text-xs text-slate-500">
              {l.checkins_validos} check-in(s) válido(s)
            </p>
            <p className="mt-2 border-t border-ink-700/60 pt-2 text-xs text-slate-500">
              Valor atual configurado:{" "}
              {l.valor_configurado_atual != null ? (
                <span className="text-slate-300">
                  {formatBRL(Number(l.valor_configurado_atual))} / check-in
                </span>
              ) : (
                "não configurado"
              )}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Estimativa, não receita confirmada. Não entra em Receita recebida, Caixa, Saldo,
        Lucro ou Meta de faturamento.
      </p>
    </div>
  );
}
