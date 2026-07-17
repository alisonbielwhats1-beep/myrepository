import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoAlunos from "@/components/painel/GestaoAlunos";
import { requireSessao } from "@/lib/auth";
import { getAlunos, getPlanos, getTodosOsTreinos } from "@/lib/data";

export default async function AlunosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const [alunos, treinos, planos] = await Promise.all([
    getAlunos(sessao.academia.id),
    getTodosOsTreinos(sessao.academia.id),
    getPlanos(sessao.academia.id),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Alunos & Treinos" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Alunos &amp; Treinos</h1>
        <p className="text-sm text-slate-400">
          Cadastre alunos e monte fichas de treino com imagens e vídeos reais.
        </p>
      </div>

      <GestaoAlunos
        slug={params.slug}
        alunosIniciais={alunos}
        treinosIniciais={treinos}
        planos={planos}
      />
    </div>
  );
}
