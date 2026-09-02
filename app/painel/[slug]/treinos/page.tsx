import AdesaoTreinos from "@/components/painel/AdesaoTreinos";
import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoTreinos from "@/components/painel/GestaoTreinos";
import { requireSecao } from "@/lib/auth";
import {
  getAdesaoTreinos,
  getCatalogoExercicios,
  getInstrutores,
  getTreinosBiblioteca,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TreinosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "treinos");
  const [treinos, catalogo, instrutores, adesao] = await Promise.all([
    getTreinosBiblioteca(sessao.academia.id),
    getCatalogoExercicios(sessao.academia.id),
    getInstrutores(sessao.academia.id),
    getAdesaoTreinos(30),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Treinos" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Treinos</h1>
        <p className="text-sm text-slate-400">
          Crie, organize e atribua fichas aos seus alunos.
        </p>
      </div>

      <AdesaoTreinos linhas={adesao} dias={30} />

      <GestaoTreinos
        slug={params.slug}
        treinosIniciais={treinos}
        catalogo={catalogo}
        instrutores={instrutores}
        podeAtribuir={sessao.papel !== "recepcao"}
        userId={sessao.userId}
        papel={sessao.papel}
      />
    </div>
  );
}
