import Sidebar from "@/components/painel/Sidebar";
import NotificationBell from "@/components/painel/NotificationBell";
import InstallPWA from "@/components/painel/InstallPWA";
import DemoBanner from "@/components/painel/DemoBanner";
import { requireSessao } from "@/lib/auth";
import { contarFeedbackNaoLido } from "@/lib/data";
import {
  contarNotificacoesNaoLidas,
  getNotificacoesPainel,
} from "@/lib/notificacoes";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  // O contador vem de um COUNT próprio, não do tamanho da lista: a lista é
  // limitada (LIMITE_PAINEL) e passaria a subnotificar assim que a academia
  // tivesse mais não lidas que esse teto.
  const [notificacoes, naoLidasTotal, feedbackNovo] = await Promise.all([
    getNotificacoesPainel(sessao.academia.id),
    contarNotificacoesNaoLidas(sessao.academia.id),
    contarFeedbackNaoLido(sessao.academia.id),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 bg-grid-fade">
      {sessao.academia.is_demo && <DemoBanner />}
      <div className="flex flex-1 lg:flex-row">
      <Sidebar
        slug={params.slug}
        academiaNome={sessao.academia.nome_fantasia}
        adminNome={sessao.nome}
        adminEmail={sessao.email}
        papel={sessao.papel}
        planoSaas={sessao.academia.plano_saas}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="no-print flex items-center justify-end gap-2">
            <InstallPWA />
            <NotificationBell
              slug={params.slug}
              papel={sessao.papel}
              academiaNome={sessao.academia.nome_fantasia}
              isDemo={sessao.academia.is_demo}
              notificacoes={notificacoes}
              naoLidasTotal={naoLidasTotal}
              feedbackNovo={feedbackNovo}
            />
          </div>
          {children}
        </div>
      </main>
      </div>
    </div>
  );
}
