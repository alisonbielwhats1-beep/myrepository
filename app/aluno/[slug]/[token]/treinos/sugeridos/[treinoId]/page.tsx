import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info, Target } from "lucide-react";
import CreditoVideosExercicios from "@/components/aluno/CreditoVideosExercicios";
import ExercicioCard from "@/components/aluno/ExercicioCard";
import ProvedorDescanso from "@/components/aluno/ProvedorDescanso";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getTreinosSugeridosAluno } from "@/lib/data";
import { separarNomeTreino } from "@/lib/treinos-sugeridos";

export const dynamic = "force-dynamic";

/**
 * Um treino sugerido, em modo consulta.
 *
 * Reusa o ExercicioCard SEM `onAlterar`: o card entra no modo leitura, com a
 * mídia de demonstração e a prescrição, mas sem campo de carga, sem esforço e
 * sem "marcar como concluído" — nada aqui é gravado. O que continua valendo é
 * o cronômetro de descanso, por isso o ProvedorDescanso envolve a lista: quem
 * está seguindo um treino pronto é justamente quem mais precisa dele.
 *
 * Buscar a lista inteira e filtrar por id é de propósito: são poucos modelos
 * por academia (a 018 semeia onze) e assim existe UMA regra de visibilidade,
 * dentro da RPC, em vez de duas que podem divergir.
 */
export default async function TreinoSugeridoPage({
  params,
}: {
  params: { slug: string; token: string; treinoId: string };
}) {
  await requireFichaAluno(params.slug, params.token);
  const sugeridos = await getTreinosSugeridosAluno(params.token, params.slug);
  const treino = sugeridos.find((t) => t.id === params.treinoId);
  if (!treino) notFound();

  const base = `/aluno/${params.slug}/${params.token}`;
  const { titulo, grupos } = separarNomeTreino(treino.nome_treino);
  const exercicios = [...(treino.exercicios ?? [])].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-4">
      <Link
        href={`${base}/treinos/sugeridos`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Treinos sugeridos
      </Link>

      <div className="surface rounded-2xl p-4">
        <p className="label-muted">{titulo}</p>
        <h1 className="mt-1 text-xl font-bold text-white">{grupos ?? titulo}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {treino.objetivo && (
            <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
              <Target className="h-3.5 w-3.5" /> {treino.objetivo}
            </span>
          )}
          {treino.nivel && (
            <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
              {treino.nivel}
            </span>
          )}
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-200">
            {exercicios.length}{" "}
            {exercicios.length === 1 ? "exercício" : "exercícios"}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-cyanx-500/25 bg-cyanx-400/[0.06] px-3 py-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-none text-cyanx-400" />
        <p className="text-xs leading-snug text-slate-400">
          Treino sugerido: nada é registrado no seu histórico. O cronômetro de
          descanso funciona normalmente.
        </p>
      </div>

      {/* Modo consulta + cronômetro. Sem `onAlterar`, o card não mostra campo
          de carga nem botão de concluir. */}
      <ProvedorDescanso>
        <div className="space-y-4">
          {exercicios.map((ex, i) => (
            <ExercicioCard
              key={ex.id}
              ex={ex}
              proximo={exercicios[i + 1]?.nome_exercicio ?? null}
            />
          ))}
        </div>
      </ProvedorDescanso>

      <CreditoVideosExercicios exercicios={exercicios} />
    </div>
  );
}
