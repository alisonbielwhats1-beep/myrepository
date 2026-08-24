"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Loader2, Search, UsersRound, X } from "lucide-react";
import type { Treino } from "@/lib/types";
import {
  atribuirTreinosVariosAlunos,
  type ResultadoAtribuirMassa,
} from "@/app/painel/[slug]/treinos/actions";

type AlunoOpcao = {
  id: string;
  nome: string;
  matricula_codigo: string | null;
};

// Espelham os tetos da server action (defesa em profundidade na interface).
const TETO_TREINOS = 20;
const TETO_ALUNOS = 30;

/**
 * Atribuição em massa: escolher VÁRIOS treinos (ex.: o ABCD do Avançado) e
 * VÁRIOS alunos, e cruzar tudo num clique. Reaproveita a RPC de lote por aluno.
 */
export default function AtribuirEmMassa({
  slug,
  treinos,
}: {
  slug: string;
  treinos: Treino[];
}) {
  const [aberto, setAberto] = useState(false);
  // Só treinos-modelo entram (ficha de aluno tem aluno_id != null).
  const modelos = useMemo(
    () => treinos.filter((t) => t.aluno_id == null),
    [treinos]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="btn-ghost"
        disabled={modelos.length === 0}
        title="Atribuir vários treinos a vários alunos de uma vez"
      >
        <UsersRound className="h-4 w-4" /> Atribuir em massa
      </button>

      {aberto &&
        createPortal(
          <Dialog
            slug={slug}
            modelos={modelos}
            onClose={() => setAberto(false)}
          />,
          document.body
        )}
    </>
  );
}

function Dialog({
  slug,
  modelos,
  onClose,
}: {
  slug: string;
  modelos: Treino[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [buscaTreino, setBuscaTreino] = useState("");
  const [buscaAluno, setBuscaAluno] = useState("");
  const [selTreinos, setSelTreinos] = useState<string[]>([]);
  const [selAlunos, setSelAlunos] = useState<string[]>([]);

  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [carregandoAlunos, setCarregandoAlunos] = useState(true);
  const [erroBuscaAluno, setErroBuscaAluno] = useState("");

  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [resultado, setResultado] = useState<ResultadoAtribuirMassa | null>(
    null
  );
  const [pending, startTransition] = useTransition();

  const treinosFiltrados = useMemo(() => {
    const termo = buscaTreino.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return modelos;
    return modelos.filter((t) =>
      [t.nome_treino, t.objetivo, t.modalidade, t.nivel, t.profissional_nome]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(termo)
    );
  }, [buscaTreino, modelos]);

  // Busca de alunos (debounce), igual à tela de atribuir 1 treino.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setCarregandoAlunos(true);
      setErroBuscaAluno("");
      try {
        const resposta = await fetch(
          `/api/treinos/${encodeURIComponent(slug)}/alunos?q=${encodeURIComponent(buscaAluno)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const corpo = (await resposta.json()) as {
          alunos?: AlunoOpcao[];
          erro?: string;
        };
        if (!resposta.ok) throw new Error(corpo.erro || "Falha ao buscar alunos.");
        setAlunos(corpo.alunos ?? []);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setAlunos([]);
        setErroBuscaAluno(e instanceof Error ? e.message : "Falha ao buscar alunos.");
      } finally {
        if (!controller.signal.aborted) setCarregandoAlunos(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [buscaAluno, slug]);

  useEffect(() => {
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [onClose, pending]);

  const limpar = () => {
    setErro("");
    setAviso("");
    setResultado(null);
  };

  const alternarTreino = (id: string) => {
    limpar();
    setSelTreinos((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= TETO_TREINOS) {
        setAviso(`Máximo de ${TETO_TREINOS} treinos por vez.`);
        return atual;
      }
      return [...atual, id];
    });
  };

  const idsTreinosFiltrados = useMemo(
    () => treinosFiltrados.map((t) => t.id),
    [treinosFiltrados]
  );
  const todosTreinosMarcados =
    idsTreinosFiltrados.length > 0 &&
    idsTreinosFiltrados.every((id) => selTreinos.includes(id));

  // "Marcar todos" só nos TREINOS (seguro: selecionar o programa inteiro). Nos
  // alunos a seleção é sempre explícita, de propósito.
  const alternarTodosTreinos = () => {
    limpar();
    if (todosTreinosMarcados) {
      setSelTreinos((atual) =>
        atual.filter((id) => !idsTreinosFiltrados.includes(id))
      );
      return;
    }
    setSelTreinos((atual) => {
      const restante = TETO_TREINOS - atual.length;
      const aMarcar = idsTreinosFiltrados.filter((id) => !atual.includes(id));
      if (restante <= 0) {
        setAviso(`Máximo de ${TETO_TREINOS} treinos por vez.`);
        return atual;
      }
      if (aMarcar.length > restante) {
        setAviso(
          `Máximo de ${TETO_TREINOS} treinos — marcamos os primeiros ${restante}.`
        );
      }
      return [...atual, ...aMarcar.slice(0, restante)];
    });
  };

  const alternarAluno = (id: string) => {
    limpar();
    setSelAlunos((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= TETO_ALUNOS) {
        setAviso(`Máximo de ${TETO_ALUNOS} alunos por vez.`);
        return atual;
      }
      return [...atual, id];
    });
  };

  const atribuir = () => {
    if (selTreinos.length === 0) {
      setErro("Marque pelo menos um treino.");
      return;
    }
    if (selAlunos.length === 0) {
      setErro("Marque pelo menos um aluno.");
      return;
    }
    setErro("");
    setAviso("");
    startTransition(async () => {
      const r = await atribuirTreinosVariosAlunos(slug, selTreinos, selAlunos);
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      if (r.criados === 0 && r.falhas.length === 0) {
        setErro(
          r.ignorados > 0
            ? "Esses alunos já tinham os treinos marcados — nada a fazer."
            : "Nada foi atribuído."
        );
        return;
      }
      setResultado(r);
      setSelAlunos([]);
      router.refresh();
    });
  };

  const podeAtribuir =
    selTreinos.length > 0 && selAlunos.length > 0 && !pending;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-ink-950/75 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar atribuição em massa"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-massa"
        className="surface-strong relative my-auto max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-3xl p-6"
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
            id="titulo-massa"
            className="flex items-center gap-2 text-lg font-semibold text-white"
          >
            <UsersRound className="h-5 w-5 text-volt-300" /> Atribuir em massa
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Escolha os treinos (ex.: o ABCD de um programa) e os alunos — o
            sistema cria a ficha de cada treino para cada aluno marcado.
          </p>
        </div>

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          {/* Coluna dos treinos */}
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Dumbbell className="h-3.5 w-3.5" /> Treinos
              <span className="text-slate-600">({selTreinos.length})</span>
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={buscaTreino}
                onChange={(e) => setBuscaTreino(e.target.value)}
                placeholder="Buscar treino (ex.: Avançado ABCD)..."
                className="inp pl-9"
              />
            </div>
            {treinosFiltrados.length > 0 && (
              <div className="mt-2 px-1">
                <button
                  type="button"
                  onClick={alternarTodosTreinos}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-volt-500/40 bg-volt-500/10 px-3 py-1 text-xs font-semibold text-volt-200 transition hover:bg-volt-500/20"
                >
                  <Check className="h-3.5 w-3.5" />
                  {todosTreinosMarcados
                    ? "Desmarcar todos"
                    : `Marcar todos (${treinosFiltrados.length})`}
                </button>
              </div>
            )}
            <div className="mt-2 max-h-60 space-y-2 overflow-y-auto pr-1">
              {treinosFiltrados.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-600 px-3 py-6 text-center text-xs text-slate-500">
                  Nenhum treino encontrado.
                </p>
              ) : (
                treinosFiltrados.slice(0, 40).map((t) => {
                  const marcado = selTreinos.includes(t.id);
                  return (
                    <label
                      key={t.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition ${
                        marcado
                          ? "border-volt-500/50 bg-volt-500/10"
                          : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarTreino(t.id)}
                        className="mt-0.5 accent-volt-400"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">
                          {t.nome_treino}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {t.exercicios?.length ?? 0} exercícios
                          {t.nivel ? ` · ${t.nivel}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna dos alunos */}
          <div className="min-w-0">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <UsersRound className="h-3.5 w-3.5" /> Alunos
              <span className="text-slate-600">({selAlunos.length})</span>
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Buscar aluno pelo nome..."
                className="inp pl-9"
              />
            </div>
            <div className="mt-2 max-h-[17rem] space-y-2 overflow-y-auto pr-1">
              {carregandoAlunos ? (
                <p className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando alunos...
                </p>
              ) : erroBuscaAluno ? (
                <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                  {erroBuscaAluno}
                </p>
              ) : alunos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-ink-600 px-3 py-6 text-center text-sm text-slate-500">
                  Nenhum aluno ativo encontrado.
                </p>
              ) : (
                alunos.map((aluno) => {
                  const marcado = selAlunos.includes(aluno.id);
                  return (
                    <label
                      key={aluno.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                        marcado
                          ? "border-volt-500/50 bg-volt-500/10"
                          : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => alternarAluno(aluno.id)}
                        className="accent-volt-400"
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
                  );
                })
              )}
            </div>
          </div>
        </div>

        {resultado && (
          <div className="mt-4 space-y-2">
            {resultado.criados > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-sm text-volt-200">
                <Check className="mt-0.5 h-4 w-4 flex-none" />
                {`${resultado.criados} ficha${resultado.criados > 1 ? "s" : ""} criada${
                  resultado.criados > 1 ? "s" : ""
                } para ${resultado.alunosAtingidos} aluno${
                  resultado.alunosAtingidos > 1 ? "s" : ""
                } — já foram avisados no app.`}
              </p>
            )}
            {resultado.ignorados > 0 && (
              <p className="rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2 text-xs text-slate-400">
                {`${resultado.ignorados} já existia${
                  resultado.ignorados > 1 ? "m" : ""
                } e foi ignorado (nada duplicado).`}
              </p>
            )}
            {resultado.falhas.length > 0 && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <p className="font-medium">Não deu para atribuir:</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {resultado.falhas.map((f, i) => (
                    <li key={i}>
                      <span className="font-medium">{f.nome}</span> — {f.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {erro && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        )}
        {aviso && !erro && (
          <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {aviso}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-ink-700 pt-4">
          <span className="text-xs text-slate-500">
            {selTreinos.length > 0 && selAlunos.length > 0
              ? `${selTreinos.length} treino${selTreinos.length > 1 ? "s" : ""} × ${selAlunos.length} aluno${selAlunos.length > 1 ? "s" : ""}`
              : "Marque treinos e alunos"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="btn-ghost"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={atribuir}
              disabled={!podeAtribuir}
              className="btn-volt"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UsersRound className="h-4 w-4" />
              )}
              {pending ? "Atribuindo..." : "Atribuir"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
