"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  MessageSquare,
  PackageX,
  X,
} from "lucide-react";
import { Notificacoes } from "@/lib/data";
import { Papel } from "@/lib/types";
import { podeAcessar } from "@/lib/permissoes";
import { cn } from "@/lib/utils";

export default function NotificationBell({
  slug,
  papel,
  dados,
}: {
  slug: string;
  papel: Papel;
  dados: Notificacoes;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const itens = [
    {
      mostrar: podeAcessar(papel, "financeiro") && dados.inadimplentes > 0,
      icon: AlertTriangle,
      cor: "text-magenta-400",
      label: `${dados.inadimplentes} mensalidade(s) vencida(s)`,
      href: `/painel/${slug}/financeiro/receitas`,
    },
    {
      mostrar: podeAcessar(papel, "loja") && dados.estoqueBaixo > 0,
      icon: PackageX,
      cor: "text-amber-300",
      label: `${dados.estoqueBaixo} produto(s) para repor`,
      href: `/painel/${slug}/loja`,
    },
    {
      mostrar: podeAcessar(papel, "feedback") && dados.feedbackNovo > 0,
      icon: MessageSquare,
      cor: "text-volt-300",
      label: `${dados.feedbackNovo} feedback(s) novo(s)`,
      href: `/painel/${slug}/feedback`,
    },
  ].filter((i) => i.mostrar);

  const total = itens.length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAberto((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink-600 text-slate-300 transition hover:bg-ink-700"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-magenta-500 px-1 text-[11px] font-bold text-white">
            {total}
          </span>
        )}
      </button>

      {aberto && (
        <div className="absolute right-0 top-12 z-50 w-72 rounded-2xl border border-ink-600 bg-ink-800 p-2 shadow-card">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold text-white">Notificações</span>
            <button
              onClick={() => setAberto(false)}
              className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {itens.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-slate-500">
              Tudo em dia. Nenhuma pendência. 🎉
            </p>
          ) : (
            <ul className="space-y-1">
              {itens.map((i, idx) => (
                <li key={idx}>
                  <Link
                    href={i.href}
                    onClick={() => setAberto(false)}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-ink-700"
                  >
                    <i.icon className={cn("h-4 w-4 flex-none", i.cor)} />
                    <span className="text-sm text-slate-200">{i.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
