import Link from "next/link";
import { ArrowUpRight, Handshake } from "lucide-react";
import Ajuda from "@/components/ui/Ajuda";
import { formatBRL } from "@/lib/utils";
import type { LinhaRepasseParceiro } from "@/lib/data";

const NOMES: Record<LinhaRepasseParceiro["plataforma"], string> = {
  totalpass: "TotalPass",
  gympass: "Gympass/Wellhub",
};

/**
 * Mini card do Dashboard, exclusivo do dono. Mesma RPC e mesma fonte
 * histórica do Financeiro (migration 049, repasses_parceiros_resumo) — nenhum
 * cálculo novo aqui, só resumo do que a RPC já devolve. Estimativa, não
 * entra em Receita, Caixa, Lucro, Saldo nem Meta de faturamento.
 */
export default function RepassesEstimadosCard({
  slug,
  linhas,
  hintPeriodo,
}: {
  slug: string;
  linhas: LinhaRepasseParceiro[];
  hintPeriodo: string;
}) {
  const total = linhas.reduce((acc, l) => acc + Number(l.valor_estimado_total), 0);
  const totalpass = linhas.find((l) => l.plataforma === "totalpass") ?? null;
  const gympass = linhas.find((l) => l.plataforma === "gympass") ?? null;

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Handshake className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Repasses estimados</h2>
          <span className="text-xs text-slate-500">{hintPeriodo}</span>
          <Ajuda texto="Estimativa baseada nos check-ins registrados e no valor por check-in configurado em Integrações — não é dinheiro confirmado e não entra em Receita, Caixa, Lucro, Saldo ou Meta de faturamento." />
        </div>
        <Link href={`/painel/${slug}/financeiro`} className="btn-ghost">
          Ver detalhes no Financeiro <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div>
          <p className="label-muted">{NOMES.totalpass}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(Number(totalpass?.valor_estimado_total ?? 0), { compacto: true })}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {Number(totalpass?.checkins_validos ?? 0)} check-in(s)
          </p>
        </div>
        <div>
          <p className="label-muted">{NOMES.gympass}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(Number(gympass?.valor_estimado_total ?? 0), { compacto: true })}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {Number(gympass?.checkins_validos ?? 0)} check-in(s)
          </p>
        </div>
        <div>
          <p className="label-muted">Total estimado</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-volt-300 [overflow-wrap:anywhere] sm:text-2xl">
            {formatBRL(total, { compacto: true })}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">TotalPass + Gympass/Wellhub</p>
        </div>
      </div>
    </div>
  );
}
