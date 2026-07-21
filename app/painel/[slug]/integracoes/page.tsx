import Breadcrumbs from "@/components/painel/Breadcrumbs";
import Integracoes from "@/components/painel/Integracoes";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function IntegracoesPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "integracoes");
  const supabase = createClient();

  const { data } = await supabase
    .from("academias")
    .select("gympass_webhook_secret, totalpass_webhook_secret")
    .eq("id", sessao.academia.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Integrações" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Integrações</h1>
        <p className="text-sm text-slate-400">
          Conecte o Gympass e o TotalPass para registrar check-ins automaticamente no seu
          controle de acessos.
        </p>
      </div>

      <Integracoes
        slug={params.slug}
        gympassSecret={data?.gympass_webhook_secret ?? "—"}
        totalpassSecret={data?.totalpass_webhook_secret ?? "—"}
      />
    </div>
  );
}
