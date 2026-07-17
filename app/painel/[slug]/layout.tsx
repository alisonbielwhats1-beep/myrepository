import Link from "next/link";
import { Smartphone } from "lucide-react";
import Logo from "@/components/Logo";
import PainelTabs from "@/components/painel/PainelTabs";
import { getAcademia } from "@/lib/data";

export default async function PainelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const academia = await getAcademia(params.slug);

  return (
    <div className="min-h-dvh bg-ink-950 bg-grid-fade">
      <header className="sticky top-0 z-30 border-b border-ink-700/70 bg-ink-950/85 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Logo />
              </Link>
              <span className="hidden h-6 w-px bg-ink-600 sm:block" />
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-white">
                  {academia?.nome_fantasia}
                </p>
                <p className="text-xs text-slate-500">{academia?.endereco}</p>
              </div>
            </div>
            <Link href={`/aluno/${params.slug}`} className="btn-ghost">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">App do Aluno</span>
            </Link>
          </div>

          <div className="mt-3">
            <PainelTabs slug={params.slug} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
