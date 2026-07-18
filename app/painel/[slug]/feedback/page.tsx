import Breadcrumbs from "@/components/painel/Breadcrumbs";
import FeedbackPainel from "@/components/painel/FeedbackPainel";
import { requireSessao } from "@/lib/auth";
import { getFeedbacks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const feedbacks = await getFeedbacks(sessao.academia.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Feedback" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Feedback dos alunos</h1>
        <p className="text-sm text-slate-400">
          Avaliações e opiniões enviadas pelos alunos pela tela deles. Use para
          entender o que está bom e o que pode melhorar.
        </p>
      </div>

      <FeedbackPainel slug={params.slug} feedbacks={feedbacks} />
    </div>
  );
}
