"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowDownCircle, ArrowUpCircle, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FinanceiroTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/painel/${slug}/financeiro`;

  const tabs = [
    { href: base, label: "Visão geral", icon: PieChart, exact: true },
    { href: `${base}/receitas`, label: "Receitas", icon: ArrowUpCircle },
    { href: `${base}/despesas`, label: "Despesas", icon: ArrowDownCircle },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const ativo = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
              ativo
                ? "bg-volt-300 text-ink-950 shadow-glow"
                : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
