import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoTreinos from "@/components/painel/GestaoTreinos";
import { requireSessao } from "@/lib/auth";
import { getCatalogoExercicios, getTreinosBiblioteca } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function TreinosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const [treinos, catalogo] = await Promise.all([
    getTreinosBiblioteca(sessao.academia.id),
    getCatalogoExercicios(),
  ]);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Treinos" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Treinos</h1>
        <p className="text-sm text-slate-400">
          Biblioteca de treinos por modalidade (Treino A, B, Funcional…). Cada
          treino pode ser compartilhado por QR Code — a pessoa escaneia e vê os
          exercícios com a animação de execução.
        </p>
      </div>

      <GestaoTreinos
        slug={params.slug}
        treinosIniciais={treinos}
        catalogo={catalogo}
      />
    </div>
  );
}
