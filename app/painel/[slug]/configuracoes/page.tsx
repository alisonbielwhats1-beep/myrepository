import Breadcrumbs from "@/components/painel/Breadcrumbs";
import ConfiguracoesAcademia from "@/components/painel/ConfiguracoesAcademia";
import GestaoPlanos from "@/components/painel/GestaoPlanos";
import IntegracoesCard from "@/components/painel/configuracoes/IntegracoesCard";
import PlanoSaasCard from "@/components/painel/configuracoes/PlanoSaasCard";
import NotificacoesConfigCard from "@/components/painel/configuracoes/NotificacoesConfigCard";
import { requireSecao } from "@/lib/auth";
import { getPlanos, getSecretsWebhook } from "@/lib/data";
import { getConfiguracoesNotificacoes } from "@/lib/notificacoes";
import { mascarar } from "@/lib/utils";
import { headers } from "next/headers";
import { planoPodeAcessar } from "@/lib/planos";
import type { StatusIntegracao } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConfiguracoesPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSecao(params.slug, "configuracoes");
  const [planos, secrets, configNotificacoes] = await Promise.all([
    getPlanos(sessao.academia.id),
    getSecretsWebhook(sessao.academia.id),
    getConfiguracoesNotificacoes(sessao.academia.id),
  ]);

  const headersList = headers();
  const host = headersList.get("host") ?? "gestacad.com.br";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Configurações" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-sm text-slate-400">
          Dados da academia, planos e mini-site público.
        </p>
      </div>

      <PlanoSaasCard slug={params.slug} planoAtual={sessao.academia.plano_saas} />

      <ConfiguracoesAcademia
        slug={params.slug}
        academia={sessao.academia}
        meuNome={sessao.nome}
        meuEmail={sessao.email}
      />

      <NotificacoesConfigCard slug={params.slug} configuracoes={configNotificacoes} />

      <GestaoPlanos slug={params.slug} planos={planos} />

      {secrets && planoPodeAcessar(sessao.academia.plano_saas, "integracoes") && (
        <IntegracoesCard
          slug={params.slug}
          baseUrl={baseUrl}
          gympassSecretMascarado={mascarar(secrets.gympass_webhook_secret)}
          gympassStatus={(secrets.gympass_status as StatusIntegracao) ?? "nao_configurada"}
          totalpassSecretMascarado={mascarar(secrets.totalpass_webhook_secret)}
          totalpassStatus={(secrets.totalpass_status as StatusIntegracao) ?? "nao_configurada"}
        />
      )}
    </div>
  );
}
