import AlunoTabBar from "@/components/aluno/AlunoTabBar";
import { requireFichaAluno } from "@/lib/aluno-publico";

export default async function AlunoFichaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string; alunoId: string };
}) {
  // Garante que o link é válido antes de renderizar qualquer sub-rota.
  await requireFichaAluno(params.slug, params.alunoId);

  return (
    <>
      {children}
      <AlunoTabBar base={`/aluno/${params.slug}/${params.alunoId}`} />
    </>
  );
}
