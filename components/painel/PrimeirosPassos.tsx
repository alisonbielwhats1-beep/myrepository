import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";
import type { ProgressoOnboarding } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * Checklist "Primeiros passos" do Dashboard — o fio condutor da ativação de uma
 * academia nova. Calcula o progresso a partir dos dados que já existem (sem
 * estado persistido, sem tabela nova) e some sozinho quando os três essenciais
 * estão feitos. Só os essenciais que TODA academia faz — plano, aluno, treino —
 * para nunca ficar preso num passo opcional.
 *
 * Renderizado só para o dono no Dashboard (a criação de plano mora em
 * Configurações, exclusiva do dono).
 */
export default function PrimeirosPassos({
  slug,
  progresso,
}: {
  slug: string;
  progresso: ProgressoOnboarding;
}) {
  const base = `/painel/${slug}`;
  const passos = [
    {
      feito: progresso.temPlano,
      titulo: "Crie seu primeiro plano",
      dica: "Defina valor e recorrência da mensalidade.",
      href: `${base}/configuracoes`,
      cta: "Criar plano",
    },
    {
      feito: progresso.temAluno,
      titulo: "Cadastre seu primeiro aluno",
      dica: "Adicione um aluno e gere o link de acesso dele.",
      href: `${base}/alunos`,
      cta: "Cadastrar aluno",
    },
    {
      feito: progresso.temTreino,
      titulo: "Monte o primeiro treino",
      dica: "Crie uma ficha ou use um modelo da biblioteca.",
      href: `${base}/treinos`,
      cta: "Montar treino",
    },
  ];

  const concluidos = passos.filter((p) => p.feito).length;
  // Tudo pronto: o card cumpriu seu papel e desaparece.
  if (concluidos === passos.length) return null;

  // O próximo passo é o primeiro ainda não concluído — é o único destacado.
  const proximoIndice = passos.findIndex((p) => !p.feito);

  return (
    <section className="surface rounded-2xl p-5" aria-label="Primeiros passos">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-volt-300" />
          <h2 className="font-semibold text-white">Primeiros passos</h2>
        </div>
        <span className="tabular-nums text-xs text-slate-500">
          {concluidos} de {passos.length} concluídos
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Deixe sua academia pronta para receber os alunos. Some quando terminar.
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className="h-full rounded-full bg-volt-300 transition-all"
          style={{ width: `${(concluidos / passos.length) * 100}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {passos.map((p, i) => {
          const proximo = i === proximoIndice;
          return (
            <li
              key={p.titulo}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                p.feito
                  ? "border-ink-700 bg-ink-800/40"
                  : proximo
                  ? "border-volt-500/40 bg-volt-500/10"
                  : "border-ink-700 bg-ink-800/40"
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 flex-none place-items-center rounded-full text-xs font-bold",
                  p.feito
                    ? "bg-volt-300 text-ink-950"
                    : "border border-ink-500 text-slate-400"
                )}
                aria-hidden="true"
              >
                {p.feito ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    p.feito ? "text-slate-400 line-through" : "text-white"
                  )}
                >
                  {p.titulo}
                </p>
                {!p.feito && (
                  <p className="truncate text-xs text-slate-500">{p.dica}</p>
                )}
              </div>

              {!p.feito && (
                <Link
                  href={p.href}
                  className={cn(
                    "flex flex-none items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                    proximo
                      ? "bg-volt-300 text-ink-950 hover:bg-volt-200"
                      : "border border-ink-600 text-slate-300 hover:bg-ink-700"
                  )}
                >
                  {p.cta}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
