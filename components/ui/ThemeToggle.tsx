"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Escolha = "light" | "dark";
const CHAVE = "gestacad-theme";

function aplicar(escolha: Escolha) {
  // O preferencial do app é o escuro; a escolha do usuário é sempre carimbada
  // em data-theme e persistida. Não há mais opção "Sistema": o app nunca segue
  // a preferência clara do aparelho — começa escuro e só fica claro por escolha.
  document.documentElement.setAttribute("data-theme", escolha);
  localStorage.setItem(CHAVE, escolha);
}

/** Alternador de tema: Escuro (preferencial) / Claro. */
export default function ThemeToggle({ className }: { className?: string }) {
  const [escolha, setEscolha] = useState<Escolha>("dark");

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE);
    setEscolha(salvo === "light" ? "light" : "dark");
  }, []);

  const opcoes: { valor: Escolha; label: string; icon: typeof Sun }[] = [
    { valor: "dark", label: "Escuro", icon: Moon },
    { valor: "light", label: "Claro", icon: Sun },
  ];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-ink-600 bg-ink-800 p-1",
        className
      )}
      role="group"
      aria-label="Tema"
    >
      {opcoes.map((o) => {
        const ativo = escolha === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => {
              setEscolha(o.valor);
              aplicar(o.valor);
            }}
            aria-pressed={ativo}
            title={o.label}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition",
              ativo
                ? "bg-volt-300 text-ink-950"
                : "text-slate-400 hover:bg-ink-700 hover:text-slate-200"
            )}
          >
            <o.icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
