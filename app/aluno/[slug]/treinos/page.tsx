import TreinoViewer from "@/components/aluno/TreinoViewer";
import { getAcademia, getAlunos, getTreinosDoAluno } from "@/lib/data";

export default async function TreinosPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const alunos = await getAlunos(academia?.id ?? "");
  const aluno = alunos.find((a) => a.status_matricula === "ativa") ?? alunos[0];
  const treinos = aluno ? await getTreinosDoAluno(aluno.id) : [];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Seus treinos</p>
        <h1 className="text-2xl font-bold text-white">Ficha de treino</h1>
      </header>

      <TreinoViewer treinos={treinos} />
    </div>
  );
}
