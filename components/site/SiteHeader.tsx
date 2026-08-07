"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#aplicativo", label: "Aplicativo do aluno" },
  { href: "#planos", label: "Planos" },
  { href: "#duvidas", label: "Dúvidas" },
];

/**
 * Cabeçalho da landing page: translúcido, fixo no topo, com menu compacto no
 * celular. "Entrar" vai para o login existente; o CTA comercial nunca leva
 * para a mesma ação (vai para a seção de contato/demonstração).
 */
export default function SiteHeader({
  hrefDemo,
  demoExterno,
}: {
  hrefDemo: string;
  /** true quando `hrefDemo` é o wa.me (destino externo). Âncora interna não abre em nova aba. */
  demoExterno: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const propsDemo = demoExterno
    ? { target: "_blank" as const, rel: "noopener noreferrer" }
    : {};

  // Trava o scroll do fundo enquanto o menu mobile está aberto e permite
  // fechar com Esc (o menu cobre a tela inteira no celular).
  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [aberto]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="#topo" aria-label="GestAcad — início" className="shrink-0">
          <Logo />
        </Link>

        {/* Navegação — desktop */}
        <nav aria-label="Navegação principal" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-ink-800 hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-xl border border-ink-600 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-ink-500 hover:bg-ink-800 sm:inline-flex sm:items-center sm:gap-2"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" /> Entrar
          </Link>
          <a
            href={hrefDemo}
            {...propsDemo}
            className="btn-volt hidden !py-2 text-sm md:inline-flex"
          >
            Agendar demonstração
          </a>

          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            aria-controls="menu-mobile"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className="grid h-11 w-11 place-items-center rounded-xl border border-ink-600 text-slate-200 transition hover:bg-ink-800 lg:hidden"
          >
            {aberto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Navegação — celular/tablet */}
      <div
        id="menu-mobile"
        hidden={!aberto}
        className={cn(
          "border-t border-ink-700/60 bg-ink-950/95 backdrop-blur-lg lg:hidden",
          aberto && "animate-fade-up"
        )}
      >
        <nav aria-label="Navegação principal (celular)" className="px-4 py-3 sm:px-6">
          <ul className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setAberto(false)}
                  className="flex min-h-[44px] items-center rounded-xl px-3 text-sm text-slate-200 transition hover:bg-ink-800 hover:text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-ink-700/60 pt-3">
            <a
              href={hrefDemo}
              {...propsDemo}
              onClick={() => setAberto(false)}
              className="btn-volt w-full"
            >
              Agendar demonstração
            </a>
            <Link
              href="/login"
              onClick={() => setAberto(false)}
              className="btn-ghost w-full"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" /> Entrar
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
