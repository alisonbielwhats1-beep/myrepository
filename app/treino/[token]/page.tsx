import { notFound } from "next/navigation";
import { Dumbbell, Target } from "lucide-react";
import ExercicioCard from "@/components/aluno/ExercicioCard";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getTreinoPublico } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TreinoPublicoPage({
  params,
}: {
  params: { token: string };
}) {
  const dados = await getTreinoPublico(params.token);
  if (!dados) notFound();

  const { treino, academia, exercicios } = dados;

  return (
    <div className="min-h-dvh bg-ink-950 bg-grid-fade">
      <div className="mx-auto max-w-md px-4 pb-16 pt-6">
        <header className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </header>

        <div className="mt-6">
          <p className="text-sm text-slate-400">{academia.nome_fantasia}</p>
          <h1 className="text-2xl font-bold text-white">{treino.nome_treino}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {treino.modalidade && (
              <span className="chip border-ink-600 bg-ink-700/60 text-slate-300">
                <Dumbbell className="h-3.5 w-3.5 text-volt-300" />
                {treino.modalidade}
              </span>
            )}
            {treino.objetivo && (
              <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
                <Target className="h-3.5 w-3.5" /> {treino.objetivo}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {exercicios.length} exercícios · demonstração da execução
          </p>
        </div>

        <div className="mt-5 space-y-4">
          {exercicios.map((ex) => (
            <ExercicioCard key={ex.id} ex={ex} />
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Treino compartilhado por {academia.nome_fantasia} · AcadFlow
        </p>
      </div>
    </div>
  );
}
