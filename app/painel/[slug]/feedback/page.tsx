import Breadcrumbs from "@/components/painel/Breadcrumbs";
import FeedbackPainel from "@/components/painel/FeedbackPainel";
import FeedbackQRCard from "@/components/painel/FeedbackQRCard";
import MigracaoPendente from "@/components/painel/MigracaoPendente";
import { requireSecao } from "@/lib/auth";
import { getFeedbacks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "feedback");

  let feedbacks: Awaited<ReturnType<typeof getFeedbacks>> = [];
  try {
    feedbacks = await getFeedbacks(sessao.academia.id);
  } catch {
    return (
      <div className="space-y-6">
        <Breadcrumbs slug={params.slug} items={[{ label: "Feedback" }]} />
        <MigracaoPendente
          arquivo="005_loja_feedback_treinos.sql"
          recurso="O feedback dos alunos"
        />
      </div>
    );
  }

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

      <FeedbackQRCard slug={params.slug} />

      <FeedbackPainel slug={params.slug} feedbacks={feedbacks} />
    </div>
  );
}
