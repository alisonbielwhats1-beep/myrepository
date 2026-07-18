import Sidebar from "@/components/painel/Sidebar";
import { requireSessao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PainelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);

  return (
    <div className="flex min-h-dvh flex-col bg-ink-950 bg-grid-fade lg:flex-row">
      <Sidebar
        slug={params.slug}
        academiaNome={sessao.academia.nome_fantasia}
        adminNome={sessao.nome}
        adminEmail={sessao.email}
      />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-4">{children}</div>
      </main>
    </div>
  );
}
