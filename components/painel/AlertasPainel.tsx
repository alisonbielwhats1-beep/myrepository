import Link from "next/link";
import { AlertTriangle, ArrowUpRight, UserX } from "lucide-react";
import { formatBRL } from "@/lib/utils";
import BotaoCobrancaWhats from "@/components/painel/BotaoCobrancaWhats";

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
}

/** Painel de alertas: inadimplência e alunos que sumiram da academia. */
export default function AlertasPainel({
  slug,
  inadimplentes,
  sumidos,
  academiaNome,
}: {
  slug: string;
  inadimplentes: AlertaInadimplente[];
  sumidos: AlertaSumido[];
  academiaNome?: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-magenta-400" />
          <h2 className="font-semibold text-white">Inadimplentes</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Mensalidade vencida e ainda não paga
        </p>

        {inadimplentes.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nenhum aluno inadimplente. 🎉
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {inadimplentes.slice(0, 8).map((a) => (
              <li key={a.alunoId} className="flex items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{a.nome}</p>
                  <p className="text-xs text-magenta-400">
                    {a.diasAtraso} {a.diasAtraso === 1 ? "dia" : "dias"} de atraso
                  </p>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="font-semibold text-white">
                    {formatBRL(a.valorTotal)}
                  </span>
                  <BotaoCobrancaWhats
                    nome={a.nome}
                    telefone={a.telefone}
                    academia={academiaNome ?? "sua academia"}
                    valor={formatBRL(a.valorTotal)}
                    data={
                      a.vencimento
                        ? new Date(a.vencimento + "T00:00:00").toLocaleDateString("pt-BR")
                        : ""
                    }
                    vencida
                    compacto
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={`/painel/${slug}/financeiro/receitas?gran=mes`}
          className="btn-ghost mt-4 w-full"
        >
          Ver receitas pendentes <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <UserX className="h-4 w-4 text-amber-400" />
          <h2 className="font-semibold text-white">Alunos sumidos</h2>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Ativos, sem acesso registrado há 14+ dias
        </p>

        {sumidos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Ninguém sumiu — todo mundo ativo apareceu recentemente.
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {sumidos.slice(0, 8).map((a) => (
              <li key={a.alunoId} className="flex items-center justify-between py-3">
                <p className="truncate text-sm font-medium text-white">{a.nome}</p>
                <span className="text-xs text-slate-500">
                  {a.ultimoAcesso
                    ? `última vez em ${new Date(a.ultimoAcesso).toLocaleDateString("pt-BR")}`
                    : "nunca veio"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <Link href={`/painel/${slug}/alunos`} className="btn-ghost mt-4 w-full">
          Ver todos os alunos <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
