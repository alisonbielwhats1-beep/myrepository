"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  DollarSign,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  UserRound,
  X,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { sairAction } from "@/lib/actions/auth";
import { Papel } from "@/lib/types";
import { podeAcessar, Secao } from "@/lib/permissoes";
import { cn } from "@/lib/utils";

export default function Sidebar({
  slug,
  academiaNome,
  adminNome,
  adminEmail,
  papel,
}: {
  slug: string;
  academiaNome: string;
  adminNome: string;
  adminEmail: string;
  papel: Papel;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const base = `/painel/${slug}`;

  const todos: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    secao: Secao;
    exact?: boolean;
  }[] = [
    { href: base, label: "Dashboard", icon: LayoutDashboard, secao: "dashboard", exact: true },
    { href: `${base}/recepcao`, label: "Recepção / Catraca", icon: ScanLine, secao: "recepcao" },
    { href: `${base}/alunos`, label: "Alunos", icon: Users, secao: "alunos" },
    { href: `${base}/treinos`, label: "Treinos", icon: Dumbbell, secao: "treinos" },
    { href: `${base}/funcionarios`, label: "Funcionários", icon: UserRound, secao: "funcionarios" },
    { href: `${base}/loja`, label: "Loja", icon: ShoppingBag, secao: "loja" },
    { href: `${base}/financeiro`, label: "Financeiro", icon: DollarSign, secao: "financeiro" },
    { href: `${base}/retencao`, label: "Retenção", icon: HeartPulse, secao: "retencao" },
    { href: `${base}/feedback`, label: "Feedback", icon: MessageSquare, secao: "feedback" },
    { href: `${base}/dashboard`, label: "Relatórios / BI", icon: BarChart3, secao: "relatorios" },
    { href: `${base}/equipe`, label: "Equipe", icon: ShieldCheck, secao: "equipe" },
    { href: `${base}/configuracoes`, label: "Configurações", icon: Settings, secao: "configuracoes" },
  ];

  const itens = todos.filter((i) => podeAcessar(papel, i.secao));

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href={base}>
          <Logo />
        </Link>
      </div>

      <div className="mx-4 mb-4 rounded-xl border border-ink-700 bg-ink-800/60 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-white">
          {academiaNome}
        </p>
        <p className="truncate text-xs text-slate-500">{adminNome}</p>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {itens.map((item) => {
          const ativo = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              aria-current={ativo ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                ativo
                  ? "bg-volt-300 text-ink-950 shadow-glow"
                  : "text-slate-300 hover:bg-ink-700/70 hover:text-white"
              )}
            >
              <item.icon className="h-4.5 w-4.5" strokeWidth={ativo ? 2.5 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-ink-700 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tema
          </span>
          <ThemeToggle />
        </div>
        <p className="truncate px-2 text-[11px] text-slate-500">{adminEmail}</p>
        <form action={sairAction}>
          <button type="submit" className="btn-ghost w-full justify-start">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Topo mobile */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-ink-700/70 bg-ink-950/90 px-4 py-3 backdrop-blur-lg lg:hidden">
        <Link href={base}>
          <Logo />
        </Link>
        <button
          onClick={() => setAberto(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-ink-600 text-slate-300"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Drawer mobile */}
      {aberto && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
            onClick={() => setAberto(false)}
          />
          <div className="surface-strong absolute inset-y-0 left-0 w-72 border-r">
            <button
              onClick={() => setAberto(false)}
              className="absolute right-3 top-4 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
            {conteudo}
          </div>
        </div>
      )}

      {/* Sidebar fixa desktop */}
      <aside className="no-print sticky top-0 hidden h-dvh w-64 flex-none border-r border-ink-700/70 bg-ink-900/60 lg:block">
        {conteudo}
      </aside>
    </>
  );
}
