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
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  MessagesSquare,
  Plug,
  ScanLine,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  Users2,
  UserRound,
  X,
} from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { sairAction } from "@/lib/actions/auth";
import { Papel, PlanoSaas } from "@/lib/types";
import { podeAcessar, Secao } from "@/lib/permissoes";
import { planoPodeAcessar, labelPlano } from "@/lib/planos";
import { cn } from "@/lib/utils";

export default function Sidebar({
  slug,
  academiaNome,
  adminNome,
  adminEmail,
  papel,
  planoSaas,
}: {
  slug: string;
  academiaNome: string;
  adminNome: string;
  adminEmail: string;
  papel: Papel;
  planoSaas: PlanoSaas;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const base = `/painel/${slug}`;

  // Grupos do menu: organiza os itens em seções nomeadas para reduzir a
  // "parede" de 15 links. Não remove nem esconde nada por papel além do que
  // podeAcessar já filtra — só agrupa. Ordem dos grupos = ordem de exibição.
  type Grupo = "operacao" | "relacionamento" | "financeiro" | "gestao";
  const GRUPOS: { id: Grupo; label: string }[] = [
    { id: "operacao", label: "Operação" },
    { id: "relacionamento", label: "Relacionamento" },
    { id: "financeiro", label: "Financeiro" },
    { id: "gestao", label: "Gestão" },
  ];

  const todos: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    secao: Secao;
    recurso: string;
    grupo: Grupo;
    exact?: boolean;
  }[] = [
    { href: base, label: "Dashboard", icon: LayoutDashboard, secao: "dashboard", recurso: "dashboard", grupo: "operacao", exact: true },
    { href: `${base}/recepcao`, label: "Recepção / Catraca", icon: ScanLine, secao: "recepcao", recurso: "recepcao", grupo: "operacao" },
    { href: `${base}/alunos`, label: "Alunos", icon: Users, secao: "alunos", recurso: "alunos", grupo: "operacao" },
    { href: `${base}/treinos`, label: "Treinos", icon: Dumbbell, secao: "treinos", recurso: "treinos", grupo: "operacao" },
    { href: `${base}/retencao`, label: "Retenção", icon: HeartPulse, secao: "retencao", recurso: "retencao", grupo: "relacionamento" },
    { href: `${base}/feedback`, label: "Feedback", icon: MessageSquare, secao: "feedback", recurso: "feedback", grupo: "relacionamento" },
    { href: `${base}/atendimento`, label: "Atendimento", icon: MessagesSquare, secao: "atendimento", recurso: "atendimento", grupo: "relacionamento" },
    { href: `${base}/comunidade`, label: "Comunidade", icon: Users2, secao: "comunidade", recurso: "comunidade", grupo: "relacionamento" },
    { href: `${base}/financeiro`, label: "Financeiro", icon: DollarSign, secao: "financeiro", recurso: "financeiro", grupo: "financeiro" },
    { href: `${base}/loja`, label: "Loja", icon: ShoppingBag, secao: "loja", recurso: "loja", grupo: "financeiro" },
    { href: `${base}/funcionarios`, label: "Funcionários", icon: UserRound, secao: "funcionarios", recurso: "funcionarios", grupo: "gestao" },
    { href: `${base}/dashboard`, label: "Relatórios / BI", icon: BarChart3, secao: "relatorios", recurso: "relatorios", grupo: "gestao" },
    { href: `${base}/equipe`, label: "Equipe", icon: ShieldCheck, secao: "equipe", recurso: "equipe", grupo: "gestao" },
    { href: `${base}/integracoes`, label: "Integrações", icon: Plug, secao: "integracoes", recurso: "integracoes", grupo: "gestao" },
    { href: `${base}/configuracoes`, label: "Configurações", icon: Settings, secao: "configuracoes", recurso: "configuracoes", grupo: "gestao" },
  ];

  // Filter by role first, then show all remaining items (locked ones included for PLG).
  const itens = todos.filter((i) => podeAcessar(papel, i.secao));
  // Só renderiza um grupo se ele tiver ao menos um item visível para o papel.
  const gruposVisiveis = GRUPOS.map((g) => ({
    ...g,
    itens: itens.filter((i) => i.grupo === g.id),
  })).filter((g) => g.itens.length > 0);

  const conteudo = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href={base}>
          <Logo />
        </Link>
      </div>

      <div className="mx-4 mb-2 rounded-xl border border-ink-700 bg-ink-800/60 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-white">
          {academiaNome}
        </p>
        <p className="truncate text-xs text-slate-500">{adminNome}</p>
      </div>

      {/* Plan chip */}
      <div className="mx-4 mb-3">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
          planoSaas === "basico"
            ? "border-slate-600 bg-slate-800/60 text-slate-400"
            : planoSaas === "profissional"
            ? "border-volt-500/40 bg-volt-500/10 text-volt-400"
            : "border-amber-500/40 bg-amber-500/10 text-amber-400"
        )}>
          {labelPlano(planoSaas)}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        {gruposVisiveis.map((grupo) => (
          <div key={grupo.id} className="mb-3">
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {grupo.label}
            </p>
            <div className="space-y-0.5">
              {grupo.itens.map((item) => {
                const bloqueado = !planoPodeAcessar(planoSaas, item.recurso);
                const ativo = !bloqueado && (item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setAberto(false)}
                    aria-current={ativo ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      ativo
                        ? "bg-volt-300 text-ink-950 shadow-glow"
                        : bloqueado
                        ? "text-slate-600 hover:bg-ink-700/40 hover:text-slate-500"
                        : "text-slate-300 hover:bg-ink-700/70 hover:text-white"
                    )}
                  >
                    <item.icon
                      className={cn("h-4 w-4 flex-none", bloqueado && "opacity-50")}
                      strokeWidth={ativo ? 2.5 : 2}
                    />
                    <span className={cn("flex-1", bloqueado && "opacity-60")}>
                      {item.label}
                    </span>
                    {bloqueado && (
                      <Lock className="h-3 w-3 flex-none text-slate-600" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="space-y-3 border-t border-ink-700 p-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Tema
          </span>
          <ThemeToggle />
        </div>
        <p className="truncate px-2 text-[11px] text-slate-500">{adminEmail}</p>
        <Link
          href={`${base}/conta`}
          onClick={() => setAberto(false)}
          className={cn(
            "btn-ghost w-full justify-start",
            pathname === `${base}/conta` && "border-volt-500/40 text-volt-300"
          )}
        >
          <UserRound className="h-4 w-4" /> Minha conta
        </Link>
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
