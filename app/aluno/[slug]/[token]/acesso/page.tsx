import AcessoView from "@/components/aluno/AcessoView";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getTokenQrAlunoPublico } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AcessoPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const tokenQrAcesso = await getTokenQrAlunoPublico(params.token, params.slug);

  return (
    <AcessoView
      academiaSlug={params.slug}
      tokenQrAcesso={tokenQrAcesso}
      matriculaCodigo={ficha.aluno.matricula_codigo}
    />
  );
}
