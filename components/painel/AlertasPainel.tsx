import Link from "next/link";
import { AlertTriangle, ArrowUpRight, UserX } from "lucide-react";
import { formatBRL } from "@/lib/utils";
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

/** Painel de alertas: inadimplência e alunos que sumiram da academia. */
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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="surface rounded-2xl p-5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400" />
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
                  <Link
                    href={`/painel/${slug}/alunos?q=${encodeURIComponent(a.nome)}`}
                    className="block truncate text-sm font-medium text-white hover:text-volt-300"
                  >
                    {a.nome}
                  </Link>
                  <p className="text-xs text-red-400">
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
                    isDemo={isDemo}
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
          Ativos, conforme o limite configurado nas Configurações
        </p>

        {sumidos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Ninguém sumiu — todo mundo ativo apareceu recentemente.
          </p>
        ) : (
          <ul className="divide-y divide-ink-700/70">
            {sumidos.slice(0, 8).map((a) => (
              <li key={a.alunoId} className="flex items-center justify-between gap-2 py-3">
                {/* Mesma estrutura do item de inadimplente: nome + motivo
                    empilhados à esquerda, ação à direita. Mantém a explicação
                    (dias sem acesso) visível, agora sem disputar a linha. */}
                <div className="min-w-0">
                  <Link
                    href={`/painel/${slug}/alunos?q=${encodeURIComponent(a.nome)}`}
                    className="block truncate text-sm font-medium text-white hover:text-volt-300"
                  >
                    {a.nome}
                  </Link>
                  <p className="text-xs text-amber-400">{a.explicacao}</p>
                </div>
                <div className="flex-none">
                  <BotaoReativacaoWhats
                    nome={a.nome}
                    telefone={a.telefone}
                    academia={academiaNome ?? "sua academia"}
                    diasSemAcesso={a.diasSemAcesso ?? null}
                    compacto
                    isDemo={isDemo}
                  />
                </div>
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
