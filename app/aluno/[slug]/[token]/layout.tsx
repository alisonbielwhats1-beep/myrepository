import type { Metadata } from "next";
import AlunoTabBar from "@/components/aluno/AlunoTabBar";
import LembrarAcesso from "@/components/aluno/LembrarAcesso";
import InstalarAppAluno from "@/components/aluno/InstalarAppAluno";
import { requireFichaAluno } from "@/lib/aluno-publico";

// Sobrescreve o manifest global (start_url /inicio) por um manifest deste
// aluno, cujo start_url é a própria ficha dele. Assim o app instalado abre
// direto na área do aluno — inclusive no iPhone, onde o app da tela inicial não
// enxerga o token guardado no Safari.
export async function generateMetadata({
  params,
}: {
  params: { slug: string; token: string };
}): Promise<Metadata> {
  return {
    manifest: `/aluno/${params.slug}/${params.token}/app.webmanifest`,
  };
}

export default async function AlunoFichaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string; token: string };
}) {
  // Garante que o link é válido antes de renderizar qualquer sub-rota.
  await requireFichaAluno(params.slug, params.token);

  return (
    <>
      {/* Guarda o acesso neste aparelho para o app reabrir direto na área do
          aluno (sem login/sem e-mail). Não renderiza nada. */}
      <LembrarAcesso slug={params.slug} token={params.token} />
      {/* Convite não intrusivo e dispensável para instalar o app. */}
      <InstalarAppAluno />
      {children}
      <AlunoTabBar base={`/aluno/${params.slug}/${params.token}`} />
    </>
  );
}
