"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Ícone de ajuda com explicação em popover. Abre por clique (e não só por
 * hover) para funcionar no celular, onde não existe hover.
 */
export default function Ajuda({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fechar);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Ajuda"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="grid h-4 w-4 place-items-center rounded-full text-slate-500 transition hover:text-slate-300"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {aberto && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-6 z-30 w-56 -translate-x-1/2 rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-xs font-normal normal-case leading-relaxed text-slate-300 shadow-xl"
        >
          {texto}
        </span>
      )}
    </span>
  );
}
