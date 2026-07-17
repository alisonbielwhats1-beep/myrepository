"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, DollarSign, ScanLine, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegação por abas do painel administrativo.
 * Cada aba é uma ROTA própria — assim um link direto (ex: para o Dashboard de
 * BI / Aba 4) abre exatamente aquela aba, e não a primeira tela por padrão.
 */
export default function PainelTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/painel/${slug}`;

  const tabs = [
    { n: 1, href: `${base}/recepcao`, label: "Recepção / Catraca", icon: ScanLine },
    { n: 2, href: `${base}/alunos`, label: "Alunos & Treinos", icon: Users },
    { n: 3, href: `${base}/financeiro`, label: "Financeiro", icon: DollarSign },
    { n: 4, href: `${base}/dashboard`, label: "Dashboard BI", icon: BarChart3 },
  ];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              active
                ? "bg-volt-300 text-ink-950 shadow-glow"
                : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
            )}
          >
            <t.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
            <span className="hidden sm:inline">{t.label}</span>
            <span
              className={cn(
                "grid h-5 w-5 place-items-center rounded-md text-[11px] sm:hidden",
                active ? "bg-ink-950/20 text-ink-950" : "bg-ink-700 text-slate-300"
              )}
            >
              {t.n}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
