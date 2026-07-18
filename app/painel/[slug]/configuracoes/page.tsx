import Breadcrumbs from "@/components/painel/Breadcrumbs";
import ConfiguracoesAcademia from "@/components/painel/ConfiguracoesAcademia";
import GestaoPlanos from "@/components/painel/GestaoPlanos";
import { requireSecao } from "@/lib/auth";
import { getPlanos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "configuracoes");
  const planos = await getPlanos(sessao.academia.id);

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Configurações" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-400">
          Dados da academia, planos e mini-site público.
        </p>
      </div>

      <ConfiguracoesAcademia slug={params.slug} academia={sessao.academia} />

      <GestaoPlanos slug={params.slug} planos={planos} />
    </div>
  );
}
