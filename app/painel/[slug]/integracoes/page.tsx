import Breadcrumbs from "@/components/painel/Breadcrumbs";
import Integracoes from "@/components/painel/Integracoes";
import { requireSecao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getConfigRepasseParceiros } from "@/lib/data";
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

  // getConfigRepasseParceiros é vazia (não erro) para quem não é dono — RLS
  // na própria tabela. Como "integracoes" já é seção exclusiva do dono
  // (lib/permissoes.ts), quem chega aqui sempre é dono.
  const [{ data }, configRepasse] = await Promise.all([
    supabase
      .from("academias")
      .select(
        "gympass_webhook_secret, totalpass_webhook_secret, gympass_status, totalpass_status"
      )
      .eq("id", sessao.academia.id)
      .maybeSingle(),
    getConfigRepasseParceiros(),
  ]);

  const repasseGympass = configRepasse.find((c) => c.plataforma === "gympass") ?? null;
  const repasseTotalpass = configRepasse.find((c) => c.plataforma === "totalpass") ?? null;

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
        gympassValorRepasse={repasseGympass?.valor_por_checkin ?? null}
        gympassRepasseAtivo={repasseGympass?.ativo ?? false}
        totalpassSecretMascarado={mascarar(data?.totalpass_webhook_secret)}
        totalpassStatus={(data?.totalpass_status as StatusIntegracao) ?? "nao_configurada"}
        totalpassValorRepasse={repasseTotalpass?.valor_por_checkin ?? null}
        totalpassRepasseAtivo={repasseTotalpass?.ativo ?? false}
        isDemo={sessao.academia.is_demo}
      />
    </div>
  );
}
