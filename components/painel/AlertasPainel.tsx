import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import BotaoCobrancaWhats from "@/components/painel/BotaoCobrancaWhats";
import BotaoReativacaoWhats from "@/components/painel/BotaoReativacaoWhats";

export interface AlertaInadimplente {
  alunoId: string;
  nome: string;
  valorTotal: number;
  diasAtraso: number;
  telefone?: string | null;
  vencimento?: string; // ISO da mensalidade vencida mais antiga
}

export interface AlertaSumido {
  alunoId: string;
  nome: string;
  ultimoAcesso: string | null; // ISO date, null = nunca veio
  /** Texto vindo de classificarRetencao — evita repetir a regra aqui. */
  explicacao: string;
  telefone?: string | null;
  /** Vem de classificarRetencao; null quando o aluno nunca acessou. */
  diasSemAcesso?: number | null;
}

type ItemUrgencia =
  | { tipo: "inadimplente"; dias: number; dado: AlertaInadimplente }
  | { tipo: "sumido"; dias: number; dado: AlertaSumido };

const LIMITE_EXIBIDO = 10;

/**
 * Painel de alertas: inadimplência e alunos sumidos numa lista única,
 * ordenada por urgência (dias de atraso / dias sem acesso). Antes eram dois
 * cards lado a lado com o mesmo peso visual, mas são naturezas diferentes —
 * inadimplência é dinheiro parado, aluno sumido é risco de cancelamento — e
 * separar por card não deixava claro qual dos dois pedia atenção primeiro.
 */
export default function AlertasPainel({
  slug,
  inadimplentes,
  sumidos,
  academiaNome,
  isDemo = false,
}: {
  slug: string;
  inadimplentes: AlertaInadimplente[];
  sumidos: AlertaSumido[];
  academiaNome?: string;
  isDemo?: boolean;
}) {
  const itens: ItemUrgencia[] = [
    ...inadimplentes.map((a) => ({ tipo: "inadimplente" as const, dias: a.diasAtraso, dado: a })),
    ...sumidos.map((a) => ({ tipo: "sumido" as const, dias: a.diasSemAcesso ?? 0, dado: a })),
  ]
    .sort((a, b) => b.dias - a.dias)
    .slice(0, LIMITE_EXIBIDO);

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn("h-4 w-4", itens.length > 0 ? "text-red-400" : "text-slate-500")} />
        <h2 className="font-semibold text-white">Ações necessárias</h2>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Inadimplência e alunos sumidos, do mais para o menos urgente
      </p>

      {itens.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          Nenhuma ação pendente por aqui. 🎉
        </p>
      ) : (
        <ul className="divide-y divide-ink-700/70">
          {itens.map((item) =>
            item.tipo === "inadimplente" ? (
              <li
                key={`inadimplente-${item.dado.alunoId}`}
                className="flex items-center justify-between gap-2 border-l-2 border-red-400/60 py-3 pl-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex flex-none items-center rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                      Inadimplente
                    </span>
                    <Link
                      href={`/painel/${slug}/alunos?q=${encodeURIComponent(item.dado.nome)}`}
                      className="truncate text-sm font-medium text-white hover:text-volt-300"
                    >
                      {item.dado.nome}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-red-400">
                    {item.dado.diasAtraso} {item.dado.diasAtraso === 1 ? "dia" : "dias"} de atraso
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="font-semibold text-white">
                    {formatBRL(item.dado.valorTotal)}
                  </span>
                  <BotaoCobrancaWhats
                    nome={item.dado.nome}
                    telefone={item.dado.telefone}
                    academia={academiaNome ?? "sua academia"}
                    valor={formatBRL(item.dado.valorTotal)}
                    data={
                      item.dado.vencimento
                        ? new Date(item.dado.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                        : ""
                    }
                    vencida
                    compacto
                    isDemo={isDemo}
                  />
                </div>
              </li>
            ) : (
              <li
                key={`sumido-${item.dado.alunoId}`}
                className="flex items-center justify-between gap-2 border-l-2 border-amber-400/60 py-3 pl-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex flex-none items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      Sumido
                    </span>
                    <Link
                      href={`/painel/${slug}/alunos?q=${encodeURIComponent(item.dado.nome)}`}
                      className="truncate text-sm font-medium text-white hover:text-volt-300"
                    >
                      {item.dado.nome}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-amber-400">{item.dado.explicacao}</p>
                </div>
                <div className="flex-none">
                  <BotaoReativacaoWhats
                    nome={item.dado.nome}
                    telefone={item.dado.telefone}
                    academia={academiaNome ?? "sua academia"}
                    diasSemAcesso={item.dado.diasSemAcesso ?? null}
                    compacto
                    isDemo={isDemo}
                  />
                </div>
              </li>
            )
          )}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/painel/${slug}/financeiro/receitas?gran=mes`}
          className="btn-ghost flex-1"
        >
          Ver receitas pendentes <ArrowUpRight className="h-4 w-4" />
        </Link>
        <Link href={`/painel/${slug}/alunos`} className="btn-ghost flex-1">
          Ver todos os alunos <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
