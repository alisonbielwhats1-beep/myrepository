import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSecao } from "@/lib/auth";
import { obterDetalheAcessoAluno } from "@/lib/acesso-aluno-detalhe";
import CicloAlunoPainel from "@/components/painel/CicloAlunoPainel";

export const dynamic = "force-dynamic";

/** Ciclo do aluno: acesso, cadastro (arquivar/reativar) e matrículas. */
export default async function CicloAlunoPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  const sessao = await requireSecao(params.slug, "alunos");
  const detalhe = await obterDetalheAcessoAluno(sessao.academia.id, params.alunoId);
  if (!detalhe) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link
          href={`/painel/${params.slug}/alunos/acesso`}
          className="inline-flex items-center gap-1 hover:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Acesso &amp; Convites
        </Link>
        <span>/</span>
        <span className="truncate text-slate-300">{detalhe.nome}</span>
      </div>

      <CicloAlunoPainel slug={params.slug} detalhe={detalhe} />
    </div>
  );
}
