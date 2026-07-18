import FeedbackForm from "@/components/aluno/FeedbackForm";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { enviarFeedback } from "@/app/aluno/[slug]/[alunoId]/actions";

export const dynamic = "force-dynamic";

export default async function AlunoFeedbackPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  await requireFichaAluno(params.slug, params.alunoId);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua opinião importa</p>
        <h1 className="text-2xl font-bold text-white">Feedback</h1>
      </header>

      <FeedbackForm enviar={enviarFeedback.bind(null, params.slug, params.alunoId)} />
    </div>
  );
}
