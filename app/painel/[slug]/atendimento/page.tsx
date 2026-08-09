import Breadcrumbs from "@/components/painel/Breadcrumbs";
import AtendimentoPainel from "@/components/painel/AtendimentoPainel";
import MigracaoPendente from "@/components/painel/MigracaoPendente";
import { requireSecao } from "@/lib/auth";
import { getAtendimentos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AtendimentoPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "atendimento");

  let atendimentos: Awaited<ReturnType<typeof getAtendimentos>> = [];
  try {
    atendimentos = await getAtendimentos(sessao.academia.id);
  } catch {
    return (
      <div className="space-y-6">
        <Breadcrumbs slug={params.slug} items={[{ label: "Atendimento" }]} />
        <MigracaoPendente
          arquivo="058_atendimento.sql"
          recurso="O atendimento aos alunos"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Atendimento" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Atendimento</h1>
        <p className="text-sm text-slate-400">
          Dúvidas e solicitações abertas pelos alunos na área deles. Diferente do
          Feedback, aqui a conversa tem ida e volta até ser resolvida.
        </p>
      </div>

      <AtendimentoPainel slug={params.slug} atendimentos={atendimentos} />
    </div>
  );
}
