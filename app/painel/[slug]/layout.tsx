import Sidebar from "@/components/painel/Sidebar";
import NotificationBell from "@/components/painel/NotificationBell";
import InstallPWA from "@/components/painel/InstallPWA";
import { requireSessao } from "@/lib/auth";
import { getNotificacoes } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const notificacoes = await getNotificacoes(sessao.academia.id);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 bg-grid-fade lg:flex-row">
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
              dados={notificacoes}
            />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
