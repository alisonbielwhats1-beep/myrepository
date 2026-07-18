import Breadcrumbs from "@/components/painel/Breadcrumbs";
import FinanceiroTabs from "@/components/painel/financeiro/FinanceiroTabs";
import { requireSecao } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FinanceiroLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  await requireSecao(params.slug, "financeiro");

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Financeiro" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Financeiro</h1>
        <p className="text-sm text-slate-400">
          Receitas, despesas, lucro e fluxo de caixa da academia.
        </p>
      </div>
      <FinanceiroTabs slug={params.slug} />
      {children}
    </div>
  );
}
