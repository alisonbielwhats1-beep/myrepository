"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronRight, Dumbbell, X } from "lucide-react";
import type { NotificacaoAluno } from "@/lib/types";
import { marcarAvisosLidos } from "@/app/aluno/[slug]/[token]/actions";

/**
 * Avisos in-app do aluno (ex.: treino novo). Aparece no topo da Home quando há
 * algo não lido. Cada aviso tem um destino claro (ex.: "Ver treino") e some ao
 * ser dispensado ou depois de o aluno abrir. Comunicação curta e direta.
 */
export default function AvisosAluno({
  slug,
  token,
  notificacoes,
}: {
  slug: string;
  token: string;
  notificacoes: NotificacaoAluno[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const base = `/aluno/${slug}/${token}`;

  if (notificacoes.length === 0) return null;

  const marcarLidos = (destino?: string) => {
    iniciar(async () => {
      await marcarAvisosLidos(slug, token);
      if (destino) router.push(destino);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      {notificacoes.map((n) => {
        const destino = n.link ? `${base}/${n.link.replace(/^\//, "")}` : null;
        const Icone = n.tipo === "treino" ? Dumbbell : Bell;
        return (
          <div
            key={n.id}
            className="relative overflow-hidden rounded-2xl border border-volt-500/40 bg-gradient-to-br from-volt-500/15 to-volt-500/5 p-4"
          >
            <button
              type="button"
              onClick={() => marcarLidos()}
              disabled={pendente}
              aria-label="Dispensar aviso"
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:text-white disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3 pr-7">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-volt-300/20 text-volt-200">
                <Icone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-bold text-white">{n.titulo}</p>
                {n.mensagem && (
                  <p className="mt-0.5 text-sm text-slate-200">{n.mensagem}</p>
                )}
              </div>
            </div>

            {destino && (
              <button
                type="button"
                onClick={() => marcarLidos(destino)}
                disabled={pendente}
                className="btn-volt mt-3 w-full justify-center disabled:opacity-60"
              >
                {n.tipo === "treino" ? "Ver meu treino" : "Ver"}
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
