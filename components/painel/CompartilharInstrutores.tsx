"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, UserCog, Users, X } from "lucide-react";
import type { Treino } from "@/lib/types";
import { compartilharComInstrutores } from "@/app/painel/[slug]/treinos/actions";

type Instrutor = { id: string; nome: string };

/**
 * Botão + diálogo para compartilhar um treino-modelo com instrutores
 * específicos da equipe (ACL — migration 081). Marcar ninguém volta o treino
 * a "privado"; marcar ≥1 grava `visibilidade='selecionado'` e a lista de
 * perfis autorizados. O RLS garante que só quem pode gerenciar o treino
 * enxerga/edita a ACL.
 */
export default function CompartilharInstrutores({
  slug,
  treino,
  instrutores,
}: {
  slug: string;
  treino: Treino;
  instrutores: Instrutor[];
}) {
  const [aberto, setAberto] = useState(false);

  // Sem outros instrutores para escolher, não há o que compartilhar.
  if (instrutores.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost"
        title="Compartilhar este treino com instrutores específicos da equipe"
      >
        <UserCog className="h-4 w-4" />
        Instrutores
      </button>

      {aberto &&
        createPortal(
          <DialogInstrutores
            slug={slug}
            treino={treino}
            instrutores={instrutores}
            onClose={() => setAberto(false)}
          />,
          document.body
        )}
    </>
  );
}

function DialogInstrutores({
  slug,
  treino,
  instrutores,
  onClose,
}: {
  slug: string;
  treino: Treino;
  instrutores: Instrutor[];
  onClose: () => void;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Carrega a ACL atual para pré-marcar os instrutores já autorizados.
  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch(
        `/api/treinos/${encodeURIComponent(slug)}/compartilhamento?treino=${encodeURIComponent(treino.id)}`,
        { cache: "no-store" }
      );
      const corpo = (await r.json()) as { instrutorIds?: string[]; erro?: string };
      if (!r.ok) throw new Error(corpo.erro || "Falha ao carregar.");
      setSelecionados(new Set(corpo.instrutorIds ?? []));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar.");
      setSelecionados(new Set());
    } finally {
      setCarregando(false);
    }
  }, [slug, treino.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onClose]);

  const alternar = (id: string) => {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
    setSucesso(null);
  };

  const salvar = async () => {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    const r = await compartilharComInstrutores(
      slug,
      treino.id,
      Array.from(selecionados)
    );
    if ("erro" in r) {
      setErro(r.erro);
    } else {
      const n = selecionados.size;
      setSucesso(
        n === 0
          ? "Treino voltou a ser privado — ninguém mais da equipe vê."
          : `Compartilhado com ${n} instrutor${n > 1 ? "es" : ""}.`
      );
    }
    setSalvando(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar compartilhamento com instrutores"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-compartilhar-instrutores"
        className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl p-6"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-9">
          <h3
            id="titulo-compartilhar-instrutores"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <UserCog className="h-5 w-5 text-volt-300" /> Compartilhar com instrutores
          </h3>
          <p className="mt-1 text-sm text-slate-400">{treino.nome_treino}</p>
        </div>

        <p className="mt-4 rounded-xl border border-volt-500/20 bg-volt-500/5 px-3 py-2 text-xs text-slate-300">
          Escolha quem da equipe pode ver este treino. Sem ninguém marcado, o
          treino fica privado (só você e dono/gerente veem).
        </p>

        {sucesso && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-sm text-volt-200">
            <Check className="mt-0.5 h-4 w-4 flex-none" /> {sucesso}
          </p>
        )}

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" /> Instrutores da equipe
            <span className="text-slate-600">({instrutores.length})</span>
          </p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {carregando ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </p>
            ) : (
              instrutores.map((ins) => {
                const marcado = selecionados.has(ins.id);
                return (
                  <label
                    key={ins.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                      marcado
                        ? "border-volt-500/50 bg-volt-500/10"
                        : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={marcado}
                      onChange={() => alternar(ins.id)}
                      className="accent-volt-400"
                    />
                    <span className="min-w-0 truncate text-sm font-medium text-white">
                      {ins.nome}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {erro && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2 border-t border-ink-700 pt-4">
          <button type="button" onClick={onClose} className="btn-ghost">
            Fechar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || carregando}
            className="btn-volt ml-auto"
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
