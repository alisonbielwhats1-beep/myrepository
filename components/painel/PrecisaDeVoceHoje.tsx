import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  PartyPopper,
  UserX,
} from "lucide-react";
import { formatBRL } from "@/lib/utils";

/**
 * Faixa "Precisa de você hoje" — o topo acionável do Dashboard (auditoria de
 * UX, item 3). Em vez de abrir com quatro números frios do mesmo tamanho, sobe
 * o que exige ação — inadimplentes, sumidos, vencendo hoje — com o número
 * grande na cor da severidade e um atalho direto pra onde se resolve. Os
 * indicadores (KPIs) passam a ser contexto, logo abaixo.
 *
 * Só monta o que já foi buscado na página (nenhuma consulta nova). Cada cartão
 * aparece apenas quando há o que fazer; sem pendências, uma mensagem calma.
 */

type Severidade = "red" | "amber" | "volt";

const ESTILO: Record<
  Severidade,
  { card: string; numero: string; badge: string; cta: string }
> = {
  red: {
    card: "border-red-500/40 hover:border-red-500/70",
    numero: "text-red-400",
    badge: "bg-red-500/15 text-red-400",
    cta: "text-red-400",
  },
  amber: {
    card: "border-amber-500/40 hover:border-amber-500/70",
    numero: "text-amber-300",
    badge: "bg-amber-500/15 text-amber-300",
    cta: "text-amber-300",
  },
  volt: {
    card: "border-volt-500/40 hover:border-volt-400",
    numero: "text-volt-300",
    badge: "bg-volt-300/15 text-volt-300",
    cta: "text-volt-300",
  },
};

interface CartaoAcao {
  chave: string;
  severidade: Severidade;
  icone: typeof AlertTriangle;
  numero: number;
  rotulo: string;
  sub: string;
  cta: string;
  href: string;
}

export default function PrecisaDeVoceHoje({
  slug,
  verFinanceiro,
  inadimplentesCount,
  valorVencido,
  sumidosCount,
  diasSumido,
  venceHojeCount,
}: {
  slug: string;
  verFinanceiro: boolean;
  inadimplentesCount: number;
  valorVencido: number;
  sumidosCount: number;
  diasSumido: number;
  venceHojeCount: number;
}) {
  const cartoes: CartaoAcao[] = [];

  if (verFinanceiro && inadimplentesCount > 0) {
    cartoes.push({
      chave: "inadimplentes",
      severidade: "red",
      icone: AlertTriangle,
      numero: inadimplentesCount,
      rotulo: inadimplentesCount === 1 ? "inadimplente" : "inadimplentes",
      sub: `${formatBRL(valorVencido)} vencidos e não pagos`,
      cta: "Cobrar no WhatsApp",
      href: `/painel/${slug}/financeiro/receitas?gran=mes`,
    });
  }

  if (sumidosCount > 0) {
    cartoes.push({
      chave: "sumidos",
      severidade: "amber",
      icone: UserX,
      numero: sumidosCount,
      rotulo: sumidosCount === 1 ? "aluno sumido" : "alunos sumidos",
      sub: `sem acesso há ${diasSumido}+ dias`,
      cta: "Reativar em lote",
      href: `/painel/${slug}/alunos`,
    });
  }

  if (verFinanceiro && venceHojeCount > 0) {
    cartoes.push({
      chave: "vence-hoje",
      severidade: "volt",
      icone: CalendarClock,
      numero: venceHojeCount,
      rotulo: venceHojeCount === 1 ? "vence hoje" : "vencem hoje",
      sub: "avise antes de virar atraso",
      cta: "Avisar antes de vencer",
      href: `/painel/${slug}/financeiro`,
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="label-muted flex items-center gap-2">
        Precisa de você hoje
      </h2>

      {cartoes.length === 0 ? (
        <div className="surface flex items-center gap-3 rounded-2xl p-5">
          <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-volt-300/15 text-volt-300">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">
              Nada pendente por aqui hoje.
            </p>
            <p className="text-xs text-slate-400">
              Sua base está em dia — aproveite para trabalhar retenção.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((c) => {
            const estilo = ESTILO[c.severidade];
            const Icone = c.icone;
            return (
              <Link
                key={c.chave}
                href={c.href}
                className={`surface group flex flex-col rounded-2xl border p-5 transition active:scale-[0.99] ${estilo.card}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`text-3xl font-extrabold tabular-nums ${estilo.numero}`}
                    >
                      {c.numero}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-200">
                      {c.rotulo}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">{c.sub}</p>
                  </div>
                  <span
                    className={`grid h-9 w-9 flex-none place-items-center rounded-xl ${estilo.badge}`}
                  >
                    <Icone className="h-5 w-5" />
                  </span>
                </div>
                <span
                  className={`mt-4 inline-flex items-center gap-1.5 text-sm font-semibold ${estilo.cta}`}
                >
                  {c.cta}
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
