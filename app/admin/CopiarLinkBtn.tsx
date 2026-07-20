"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export default function CopiarLinkBtn({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    const url = `${window.location.origin}/painel/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button
      onClick={copiar}
      className="rounded p-1.5 text-slate-500 hover:text-volt-300 hover:bg-volt-500/10 transition-colors"
      title="Copiar link do painel"
    >
      {copiado ? (
        <Check className="h-4 w-4 text-green-400" />
      ) : (
        <Link2 className="h-4 w-4" />
      )}
    </button>
  );
}
