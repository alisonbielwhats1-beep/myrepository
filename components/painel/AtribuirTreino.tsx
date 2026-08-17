"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormState, useFormStatus } from "react-dom";
import {
  Check,
  Clock,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Treino } from "@/lib/types";
import { formatDataDeInstante } from "@/lib/utils";
import {
  atribuirTreinoBiblioteca,
  removerAtribuicaoTreino,
} from "@/app/painel/[slug]/treinos/actions";

type AlunoOpcao = {
  id: string;
  nome: string;
  matricula_codigo: string | null;
};

type Atribuicao = {
  treinoId: string;
  alunoId: string;
  alunoNome: string;
  atribuidoEm: string | null;
};

export default function AtribuirTreino({
  slug,
  treino,
  variant = "volt",
  label = "Atribuir a aluno",
  controlado = false,
  aberto: abertoProp,
  onClose: onCloseProp,
}: {
  slug: string;
  treino: Treino;
  /** Estilo do gatilho. "outline" mantém a tela neutra (verde só no topo). */
  variant?: "volt" | "outline";
  label?: string;
  /**
   * Modo controlado: não renderiza gatilho próprio; o diálogo abre/fecha por
   * `aberto`/`onClose` do pai. Usado quando o gatilho vive em outro lugar (ex.:
   * um item do menu "•••"), para o diálogo não desmontar junto com o menu.
   */
  controlado?: boolean;
  aberto?: boolean;
  onClose?: () => void;
}) {
  const [abertoLocal, setAbertoLocal] = useState(false);
  const aberto = controlado ? !!abertoProp : abertoLocal;
  const fechar = () => (controlado ? onCloseProp?.() : setAbertoLocal(false));

  return (
    <>
      {!controlado && (
        <button
          type="button"
          onClick={() => setAbertoLocal(true)}
          className={variant === "volt" ? "btn-volt" : "btn-outline"}
          title="Criar uma cópia deste treino na ficha de um aluno"
        >
          <UserPlus className="h-4 w-4" />
          {label}
        </button>
      )}

      {aberto &&
        createPortal(
          <DialogAtribuir slug={slug} treino={treino} onClose={fechar} />,
          document.body
        )}
    </>
  );
}

function formatarData(iso: string | null): string {
  if (!iso) return "";
  if (Number.isNaN(new Date(iso).getTime())) return "";
  return formatDataDeInstante(iso);
}

function DialogAtribuir({
  slug,
  treino,
  onClose,
}: {
  slug: string;
  treino: Treino;
  onClose: () => void;
}) {
  const acao = atribuirTreinoBiblioteca.bind(null, slug, treino.id);
  const [estado, formAction] = useFormState(acao, {});
  const [busca, setBusca] = useState("");
  const [alunos, setAlunos] = useState<AlunoOpcao[]>([]);
  const [alunoId, setAlunoId] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erroBusca, setErroBusca] = useState("");

  const [atribuicoes, setAtribuicoes] = useState<Atribuicao[]>([]);
  const [carregandoAtrib, setCarregandoAtrib] = useState(true);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  // Carrega/recarrega a lista de quem já recebeu este modelo.
  const carregarAtribuicoes = useCallback(async () => {
    setCarregandoAtrib(true);
    try {
      const r = await fetch(
        `/api/treinos/${encodeURIComponent(slug)}/atribuicoes?modelo=${encodeURIComponent(treino.id)}`,
        { cache: "no-store" }
      );
      const corpo = (await r.json()) as { atribuicoes?: Atribuicao[] };
      setAtribuicoes(corpo.atribuicoes ?? []);
    } catch {
      setAtribuicoes([]);
    } finally {
      setCarregandoAtrib(false);
    }
  }, [slug, treino.id]);

  useEffect(() => {
    carregarAtribuicoes();
  }, [carregarAtribuicoes]);

  // Após atribuir com sucesso: NÃO fecha — mostra confirmação, limpa a seleção
  // e recarrega a lista, para o professor ver quem recebeu e notificar em série.
  useEffect(() => {
    if (estado.ok) {
      const nome = alunos.find((a) => a.id === alunoId)?.nome;
      setSucesso(
        nome
          ? `Treino atribuído a ${nome} — o aluno já foi avisado no app dele.`
          : "Treino atribuído — o aluno já foi avisado no app dele."
      );
      setAlunoId("");
      setBusca("");
      carregarAtribuicoes();
      const t = window.setTimeout(() => setSucesso(null), 6000);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  // Busca de alunos (debounce).
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
        setErroBusca(erro instanceof Error ? erro.message : "Falha ao buscar alunos.");
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

  const remover = async (a: Atribuicao) => {
    setRemovendo(a.treinoId);
    const r = await removerAtribuicaoTreino(slug, a.treinoId);
    if ("ok" in r) {
      setAtribuicoes((prev) => prev.filter((x) => x.treinoId !== a.treinoId));
      setSucesso(`Treino removido da ficha de ${a.alunoNome}.`);
      window.setTimeout(() => setSucesso(null), 5000);
    }
    setRemovendo(null);
  };

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

        {sucesso && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-sm text-volt-200">
            <Check className="mt-0.5 h-4 w-4 flex-none" /> {sucesso}
          </p>
        )}

        {/* Já atribuído a */}
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            <Users className="h-3.5 w-3.5" /> Já atribuído a
            {!carregandoAtrib && (
              <span className="text-slate-600">({atribuicoes.length})</span>
            )}
          </p>
          <div className="mt-2 space-y-2">
            {carregandoAtrib ? (
              <p className="flex items-center gap-2 py-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
              </p>
            ) : atribuicoes.length === 0 ? (
              <p className="rounded-xl border border-dashed border-ink-600 px-3 py-3 text-center text-xs text-slate-500">
                Ninguém ainda. Escolha um aluno abaixo para atribuir.
              </p>
            ) : (
              atribuicoes.map((a) => (
                <div
                  key={a.treinoId}
                  className="flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">
                      {a.alunoNome}
                    </p>
                    {a.atribuidoEm && (
                      <p className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Clock className="h-3 w-3" /> {formatarData(a.atribuidoEm)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remover(a)}
                    disabled={removendo === a.treinoId}
                    className="flex items-center gap-1 rounded-lg border border-ink-600 px-2 py-1 text-xs text-slate-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
                    title="Remover este treino da ficha do aluno"
                  >
                    {removendo === a.treinoId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remover
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-volt-500/20 bg-volt-500/5 px-3 py-2 text-xs text-slate-300">
          Será criada uma cópia independente na ficha do aluno, e ele recebe um
          aviso no app. O modelo original não é alterado.
        </div>

        <form action={formAction} className="mt-4 space-y-4">
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

          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
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
              Fechar
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
