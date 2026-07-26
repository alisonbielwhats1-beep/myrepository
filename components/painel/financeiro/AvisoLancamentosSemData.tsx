import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { formatBRL } from "@/lib/utils";

/**
 * Aviso de lançamentos marcados como pagos sem a data do pagamento.
 *
 * O texto evita jargão de propósito: o dono não precisa saber o que é "regime
 * de caixa" para entender que faltou informar quando o dinheiro entrou.
 */
export default function AvisoLancamentosSemData({
  slug,
  receitas,
  receitasValor,
  despesas,
  despesasValor,
}: {
  slug: string;
  receitas: number;
  receitasValor: number;
  despesas: number;
  despesasValor: number;
}) {
  if (receitas === 0 && despesas === 0) return null;

  const base = `/painel/${slug}/financeiro`;

  return (
    <div className="no-print rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <AlertTriangle className="h-4 w-4 flex-none" />
        Falta dizer quando esses pagamentos aconteceram
      </p>
      <p className="mt-1 text-xs text-amber-300/80">
        Eles estão marcados como pagos, mas sem a data. Enquanto isso, não entram
        nos totais de dinheiro que entrou e saiu.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {receitas > 0 && (
          <Link
            href={`${base}/receitas?periodo=todos&status=pago&pagamento=sem_data`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-ink-900/40 px-3 py-2 transition hover:border-amber-400/50"
          >
            <span className="text-xs text-amber-100">
              <b>{receitas}</b> recebimento(s)
              <span className="block text-amber-300/70">
                {formatBRL(receitasValor)}
              </span>
            </span>
            <span className="flex flex-none items-center gap-1 text-xs font-medium text-amber-100">
              Corrigir <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}

        {despesas > 0 && (
          <Link
            href={`${base}/despesas?periodo=todos&pagamento=sem_data`}
            className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-ink-900/40 px-3 py-2 transition hover:border-amber-400/50"
          >
            <span className="text-xs text-amber-100">
              <b>{despesas}</b> pagamento(s)
              <span className="block text-amber-300/70">
                {formatBRL(despesasValor)}
              </span>
            </span>
            <span className="flex flex-none items-center gap-1 text-xs font-medium text-amber-100">
              Corrigir <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
