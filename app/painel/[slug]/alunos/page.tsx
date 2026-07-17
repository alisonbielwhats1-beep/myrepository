import GestaoAlunos from "@/components/painel/GestaoAlunos";
import { getAcademia, getAlunos, getTreinosDoAluno } from "@/lib/data";
import { Treino } from "@/lib/types";

export default async function AlunosPage({
  params,
}: {
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);
  const alunos = await getAlunos(academia?.id ?? "");

  // Carrega os treinos de todos os alunos para o construtor de fichas.
  const treinosArrays = await Promise.all(
    alunos.map((a) => getTreinosDoAluno(a.id))
  );
  const treinos: Treino[] = treinosArrays.flat();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alunos &amp; Treinos</h1>
        <p className="text-sm text-slate-400">
          Cadastre alunos e monte fichas de treino com imagens reais dos
          equipamentos.
        </p>
      </div>

      <GestaoAlunos alunosIniciais={alunos} treinosIniciais={treinos} />
    </div>
  );
}
