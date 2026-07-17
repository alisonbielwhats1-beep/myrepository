import TreinoViewer from "@/components/aluno/TreinoViewer";
import { requireFichaAluno } from "@/lib/aluno-publico";

export default async function TreinosPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.alunoId);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Seus treinos</p>
        <h1 className="text-2xl font-bold text-white">Ficha de treino</h1>
      </header>

      <TreinoViewer treinos={ficha.treinos} />
    </div>
  );
}
