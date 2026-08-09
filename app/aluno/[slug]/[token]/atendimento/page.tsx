import AtendimentoAluno from "@/components/aluno/AtendimentoAluno";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getAtendimentosDoAluno } from "@/lib/data";
import { AtendimentoDoAluno } from "@/lib/types";
import {
  abrirAtendimento,
  responderAtendimentoAluno,
} from "@/app/aluno/[slug]/[token]/actions";

export const dynamic = "force-dynamic";

export default async function AlunoAtendimentoPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);

  // Antes da migration 058 as RPCs não existem: a tela mostra o estado vazio
  // em vez de quebrar a área do aluno inteira.
  let atendimentos: AtendimentoDoAluno[] = [];
  let indisponivel = false;
  try {
    atendimentos = await getAtendimentosDoAluno(params.token, params.slug);
  } catch {
    indisponivel = true;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Precisa de ajuda?</p>
        <h1 className="text-2xl font-bold text-white">Fale com a academia</h1>
      </header>

      {indisponivel ? (
        <p className="surface rounded-2xl p-6 text-sm text-slate-400">
          O atendimento ainda não está disponível nesta academia.
        </p>
      ) : (
        <AtendimentoAluno
          slug={params.slug}
          token={params.token}
          atendimentos={atendimentos}
          abrir={abrirAtendimento.bind(null, params.slug, params.token)}
          responder={responderAtendimentoAluno}
        />
      )}
    </div>
  );
}
