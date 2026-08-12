"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { lerAcessoLembrado } from "@/lib/aluno-dispositivo";

/**
 * Tela inicial do app instalado (start_url do PWA). Decide o destino sem pedir
 * login quando não precisa:
 *   - se o aparelho LEMBRA o acesso de um aluno (link pessoal) -> abre a área
 *     dele direto (modelo sem login/sem e-mail);
 *   - senão -> cai no resolvedor /painel (equipe logada vai ao painel; aluno
 *     autenticado vai à área; sem sessão vai ao login).
 *
 * É um Client Component porque a decisão depende do localStorage, que só existe
 * no navegador. Mostra um estado curto de "abrindo" para não piscar.
 */
export default function InicioPage() {
  useEffect(() => {
    const acesso = lerAcessoLembrado();
    if (acesso) {
      window.location.replace(`/aluno/${acesso.slug}/${acesso.token}`);
    } else {
      window.location.replace("/painel");
    }
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-ink-950 bg-grid-fade">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin text-volt-300" />
        <p className="text-sm">Abrindo…</p>
      </div>
    </main>
  );
}
