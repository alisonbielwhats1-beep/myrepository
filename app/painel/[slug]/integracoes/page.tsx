import Breadcrumbs from "@/components/painel/Breadcrumbs";
import Integracoes from "@/components/painel/Integracoes";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mascarar } from "@/lib/utils";
import type { StatusIntegracao } from "@/lib/types";

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
    .select(
      "gympass_webhook_secret, totalpass_webhook_secret, gympass_status, totalpass_status"
    )
    .eq("id", sessao.academia.id)
    .maybeSingle();

  // O segredo completo nunca chega ao client — apenas o sufixo mascarado.
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
        gympassSecretMascarado={mascarar(data?.gympass_webhook_secret)}
        gympassStatus={(data?.gympass_status as StatusIntegracao) ?? "nao_configurada"}
        totalpassSecretMascarado={mascarar(data?.totalpass_webhook_secret)}
        totalpassStatus={(data?.totalpass_status as StatusIntegracao) ?? "nao_configurada"}
        isDemo={sessao.academia.is_demo}
      />
    </div>
  );
}
