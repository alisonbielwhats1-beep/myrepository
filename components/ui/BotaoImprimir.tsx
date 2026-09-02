"use client";

import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";

/**
 * Botão "Imprimir" da página de impressão da ficha. Chama a impressão nativa do
 * navegador (window.print), que manda para qualquer impressora conectada ao
 * computador/tablet — sem integração de hardware. Com `auto`, abre a janela de
 * impressão sozinho ao carregar a página (o usuário chegou aqui justamente para
 * imprimir); o botão continua disponível para reimprimir.
 */
export default function BotaoImprimir({ auto = true }: { auto?: boolean }) {
  const jaAbriu = useRef(false);

  useEffect(() => {
    if (!auto || jaAbriu.current) return;
    jaAbriu.current = true;
    // Pequeno atraso para o layout/fontes assentarem antes do diálogo.
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
    >
      <Printer className="h-4 w-4" /> Imprimir
    </button>
  );
}
