"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Loader2, Search, X } from "lucide-react";
import { atribuirTreinoBiblioteca } from "@/app/painel/[slug]/treinos/actions";

export type ModeloTreinoResumo = {
  id: string;
  nome_treino: string;
  objetivo: string | null;
  modalidade: string | null;
  nivel: string | null;
  publico_alvo: string | null;
  profissional_nome: string | null;
  total_exercicios: number;
};

export default function UsarModeloTreino({
  slug,
  alunoId,
  alunoNome,
  modelos,
}: {
  slug: string;
  alunoId: string;
  alunoNome: string;
  modelos: ModeloTreinoResumo[];
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-volt"
        disabled={modelos.length === 0}
        title={
          modelos.length === 0
            ? "Nenhum treino disponível na biblioteca"
            : "Criar a ficha a partir de um treino da biblioteca"
        }
      >
        <Dumbbell className="h-4 w-4" /> Usar treino da biblioteca
      </button>

      {aberto &&
        createPortal(
          <DialogModelo
            slug={slug}
            alunoId={alunoId}
            alunoNome={alunoNome}
            modelos={modelos}
            onClose={() => setAberto(false)}
          />,
          document.body
        )}
    </>
  );
}

function DialogModelo({
  slug,
  alunoId,
  alunoNome,
  modelos,
  onClose,
}: {
  slug: string;
  alunoId: string;
  alunoNome: string;
  modelos: ModeloTreinoResumo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [modeloId, setModeloId] = useState("");
  const [nomeTreino, setNomeTreino] = useState("");
  const [erro, setErro] = useState("");
  const [concluido, setConcluido] = useState(false);
  const [pending, startTransition] = useTransition();

  const modelosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return modelos;
    return modelos.filter((modelo) =>
      [
        modelo.nome_treino,
        modelo.objetivo,
        modelo.modalidade,
        modelo.nivel,
        modelo.publico_alvo,
        modelo.profissional_nome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo)
    );
  }, [busca, modelos]);

  useEffect(() => {
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onClose, pending]);

  const selecionarModelo = (modelo: ModeloTreinoResumo) => {
    setModeloId(modelo.id);
    setNomeTreino(modelo.nome_treino);
    setErro("");
  };

  const atribuir = () => {
    if (!modeloId) {
      setErro("Escolha um treino da biblioteca.");
      return;
    }

    startTransition(async () => {
      const dados = new FormData();
      dados.set("aluno_id", alunoId);
      dados.set("nome_treino", nomeTreino.trim());
      const resultado = await atribuirTreinoBiblioteca(
        slug,
        modeloId,
        {},
        dados
      );

      if (resultado.erro) {
        setErro(resultado.erro);
        return;
      }

      setConcluido(true);
      router.refresh();
      window.setTimeout(onClose, 900);
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar seleção de treino"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-usar-modelo"
        className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl p-6"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:text-white disabled:opacity-40"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pr-9">
          <h3
            id="titulo-usar-modelo"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <Dumbbell className="h-5 w-5 text-volt-300" /> Usar treino da
            biblioteca
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Escolha o modelo que será atribuído a {alunoNome}.
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-volt-500/20 bg-volt-500/5 px-3 py-2 text-xs text-slate-300">
          O sistema criará uma cópia independente. Depois você poderá ajustar
          exercícios, séries e cargas somente para este aluno.
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por nome, objetivo, nível ou profissional..."
            className="inp pl-9"
            autoFocus
          />
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
          {modelosFiltrados.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-600 px-3 py-8 text-center text-sm text-slate-500">
              Nenhum treino encontrado.
            </p>
          ) : (
            modelosFiltrados.slice(0, 30).map((modelo) => {
              const selecionado = modelo.id === modeloId;
              return (
                <button
                  key={modelo.id}
                  type="button"
                  onClick={() => selecionarModelo(modelo)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    selecionado
                      ? "border-volt-500/50 bg-volt-500/10"
                      : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        {modelo.nome_treino}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {modelo.total_exercicios} exercícios
                        {modelo.profissional_nome
                          ? ` · por ${modelo.profissional_nome}`
                          : ""}
                      </span>
                    </span>
                    {selecionado && (
                      <Check className="mt-0.5 h-4 w-4 flex-none text-volt-300" />
                    )}
                  </span>
                  {(modelo.objetivo || modelo.nivel || modelo.publico_alvo) && (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {[modelo.objetivo, modelo.nivel, modelo.publico_alvo]
                        .filter(Boolean)
                        .map((rotulo) => (
                          <span
                            key={rotulo}
                            className="chip border-ink-600 bg-ink-800 text-[10px] text-slate-400"
                          >
                            {rotulo}
                          </span>
                        ))}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {modeloId && (
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-400">
              Nome na ficha do aluno
            </span>
            <input
              value={nomeTreino}
              onChange={(evento) => setNomeTreino(evento.target.value)}
              maxLength={120}
              className="inp"
              required
            />
          </label>
        )}

        {erro && (
          <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="btn-ghost"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={atribuir}
            disabled={!modeloId || !nomeTreino.trim() || pending || concluido}
            className="btn-volt"
          >
            {concluido ? (
              <Check className="h-4 w-4" />
            ) : pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Dumbbell className="h-4 w-4" />
            )}
            {concluido ? "Ficha criada" : pending ? "Criando ficha..." : "Usar este treino"}
          </button>
        </div>
      </div>
    </div>
  );
}
