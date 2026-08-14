"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormState, useFormStatus } from "react-dom";
import { Check, Loader2, Search, UserPlus, X } from "lucide-react";
import type { Treino } from "@/lib/types";
import { atribuirTreinoBiblioteca } from "@/app/painel/[slug]/treinos/actions";

type AlunoOpcao = {
  id: string;
  nome: string;
  matricula_codigo: string | null;
};

export default function AtribuirTreino({
  slug,
  treino,
}: {
  slug: string;
  treino: Treino;
}) {
  const [aberto, setAberto] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const concluir = () => {
    setAberto(false);
    setConfirmado(true);
    window.setTimeout(() => setConfirmado(false), 2200);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-volt"
        title="Criar uma cópia deste treino na ficha de um aluno"
      >
        {confirmado ? (
          <Check className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {confirmado ? "Atribuído" : "Atribuir a aluno"}
      </button>

      {aberto &&
        createPortal(
          <DialogAtribuir
            slug={slug}
            treino={treino}
            onClose={() => setAberto(false)}
            onConcluido={concluir}
          />,
          document.body
        )}
    </>
  );
}

function DialogAtribuir({
  slug,
  treino,
  onClose,
  onConcluido,
}: {
  slug: string;
  treino: Treino;
  onClose: () => void;
  onConcluido: () => void;
}) {
  const acao = atribuirTreinoBiblioteca.bind(null, slug, treino.id);
  const [estado, formAction] = useFormState(acao, {});
  const [busca, setBusca] = useState("");
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [alunoId, setAlunoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroBusca, setErroBusca] = useState("");

  useEffect(() => {
    if (estado.ok) onConcluido();
    // O callback fecha o portal; repetir por mudança de identidade não é desejado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarregando(true);
      setErroBusca("");
      try {
        const resposta = await fetch(
          `/api/treinos/${encodeURIComponent(slug)}/alunos?q=${encodeURIComponent(busca)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const corpo = (await resposta.json()) as {
          alunos?: AlunoOpcao[];
          erro?: string;
        };
        if (!resposta.ok) throw new Error(corpo.erro || "Falha ao buscar alunos.");
        setAlunos(corpo.alunos ?? []);
        setAlunoId((atual) =>
          (corpo.alunos ?? []).some((aluno) => aluno.id === atual) ? atual : ""
        );
      } catch (erro) {
        if (erro instanceof DOMException && erro.name === "AbortError") return;
        setAlunos([]);
        setAlunoId("");
        setErroBusca(
          erro instanceof Error ? erro.message : "Falha ao buscar alunos."
        );
      } finally {
        if (!controller.signal.aborted) setCarregando(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [busca, slug]);

  useEffect(() => {
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar atribuição de treino"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-atribuir-treino"
        className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-6"
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
            id="titulo-atribuir-treino"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <UserPlus className="h-5 w-5 text-volt-300" /> Atribuir a aluno
          </h3>
          <p className="mt-1 text-sm text-slate-400">{treino.nome_treino}</p>
        </div>

        <div className="mt-4 rounded-xl border border-volt-500/20 bg-volt-500/5 px-3 py-2 text-xs text-slate-300">
          Será criada uma cópia independente na ficha do aluno. O modelo
          original não será alterado.
        </div>

        <form action={formAction} className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Nome na ficha do aluno
            </span>
            <input
              name="nome_treino"
              defaultValue={treino.nome_treino}
              maxLength={120}
              className="inp"
              required
            />
          </label>

          <div>
            <label htmlFor="buscar-aluno-treino" className="label-muted">
              Escolha o aluno
            </label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                id="buscar-aluno-treino"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar aluno pelo nome..."
                className="inp pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {carregando ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando alunos...
              </p>
            ) : erroBusca ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                {erroBusca}
              </p>
            ) : alunos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-3 py-6 text-center text-sm text-slate-500">
                Nenhum aluno ativo encontrado.
              </p>
            ) : (
              alunos.map((aluno) => (
                <label
                  key={aluno.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 transition ${
                    alunoId === aluno.id
                      ? "border-volt-500/50 bg-volt-500/10"
                      : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                  }`}
                >
                  <input
                    type="radio"
                    name="aluno_id"
                    value={aluno.id}
                    checked={alunoId === aluno.id}
                    onChange={() => setAlunoId(aluno.id)}
                    className="accent-volt-400"
                    required
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {aluno.nome}
                    </span>
                    {aluno.matricula_codigo && (
                      <span className="block text-xs text-slate-500">
                        Matrícula {aluno.matricula_codigo}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>

          {estado.erro && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {estado.erro}
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-ink-700 pt-4">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancelar
            </button>
            <BotaoAtribuir desabilitado={!alunoId} />
          </div>
        </form>
      </div>
    </div>
  );
}

function BotaoAtribuir({ desabilitado }: { desabilitado: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={desabilitado || pending}
      className="btn-volt ml-auto"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {pending ? "Atribuindo..." : "Atribuir treino"}
    </button>
  );
}

