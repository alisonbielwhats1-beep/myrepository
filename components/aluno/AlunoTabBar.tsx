"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, QrCode, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navegação inferior do app do aluno — 5 itens, prioridade visual em Treino e
 * Comunidade (as duas primeiras funções que engajam o aluno no dia a dia). O
 * QR de acesso deixou de ser a home e virou uma aba própria ("Acesso"), fora
 * do foco principal enquanto a catraca não está pronta. Mensalidades, Loja,
 * Feedback e Frequência continuam acessíveis pela Home e pelo Perfil (nenhum
 * link publicado quebra), só saíram da barra fixa.
 */
export default function AlunoTabBar({ base }: { base: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: base, label: "Início", icon: Home, exact: true },
    { href: `${base}/treinos`, label: "Treinos", icon: Dumbbell, exact: false },
    { href: `${base}/comunidade`, label: "Comunidade", icon: Users, exact: false },
    { href: `${base}/acesso`, label: "Acesso", icon: QrCode, exact: false },
    { href: `${base}/perfil`, label: "Perfil", icon: User, exact: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="m-3 flex items-center justify-around rounded-2xl border border-ink-600/70 bg-ink-800/90 p-1.5 shadow-card backdrop-blur-lg">
        {tabs.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[10px] font-medium transition",
                active
                  ? "bg-volt-300/15 text-volt-300"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <t.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
