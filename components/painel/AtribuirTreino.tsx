"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFormState, useFormStatus } from "react-dom";
import {
  ArrowLeftRight,
  Check,
  Clock,
  Loader2,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import type { Treino } from "@/lib/types";
import { formatDataDeInstante } from "@/lib/utils";
import type { DiaSemana, FichaRealocada } from "@/lib/dias-semana";
import { fraseRealocacao, resumoDias } from "@/lib/dias-semana";
import SeletorDiasTreino from "./SeletorDiasTreino";
import {
  atribuirTreinoBiblioteca,
  definirDiasTreino,
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
  diasSemana: number[];
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
  const [dias, setDias] = useState<DiaSemana[]>([]);
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
      setDias([]);
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
                <LinhaAtribuicao
                  key={a.treinoId}
                  slug={slug}
                  atribuicao={a}
                  removendo={removendo === a.treinoId}
                  onRemover={() => remover(a)}
                  onDiasAlterados={(novos) =>
                    setAtribuicoes((prev) =>
                      prev.map((x) =>
                        x.treinoId === a.treinoId ? { ...x, diasSemana: novos } : x
                      )
                    )
                  }
                />
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
            <span className="mb-1.5 block text-xs font-medium text-slate-400">
              Dias do treino{" "}
              <span className="font-normal text-slate-500">
                (opcional — deixe vazio para aparecer em “Todos”)
              </span>
            </span>
            <SeletorDiasTreino name="dias" value={dias} onChange={setDias} />
          </div>

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

/**
 * Uma linha de "Já atribuído a": nome, data, resumo dos dias e um editor de
 * dias inline (salva via `definirDiasTreino` sem re-atribuir a ficha).
 */
function LinhaAtribuicao({
  slug,
  atribuicao,
  removendo,
  onRemover,
  onDiasAlterados,
}: {
  slug: string;
  atribuicao: Atribuicao;
  removendo: boolean;
  onRemover: () => void;
  onDiasAlterados: (dias: number[]) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [dias, setDias] = useState<DiaSemana[]>(atribuicao.diasSemana as DiaSemana[]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [realocados, setRealocados] = useState<FichaRealocada[]>([]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    const r = await definirDiasTreino(slug, atribuicao.treinoId, dias);
    setSalvando(false);
    if ("erro" in r) {
      setErro(r.erro);
      return;
    }
    onDiasAlterados(r.dias);
    setEditando(false);
    // Cada dia é um slot exclusivo por aluno: se essa troca tirou o dia de
    // outra ficha dele, avisa aqui em vez de acontecer calado.
    setRealocados(r.realocados);
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {atribuicao.alunoNome}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
            {atribuicao.atribuidoEm && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {formatarData(atribuicao.atribuidoEm)}
              </span>
            )}
            <span>· {resumoDias(atribuicao.diasSemana)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDias(atribuicao.diasSemana as DiaSemana[]);
            setEditando((v) => !v);
          }}
          className="flex items-center gap-1 rounded-lg border border-ink-600 px-2 py-1 text-xs text-slate-400 transition hover:border-ink-500 hover:text-slate-200"
          title="Editar dias"
        >
          <Pencil className="h-3.5 w-3.5" /> Dias
        </button>
        <button
          type="button"
          onClick={onRemover}
          disabled={removendo}
          className="flex items-center gap-1 rounded-lg border border-ink-600 px-2 py-1 text-xs text-slate-400 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-60"
          title="Remover este treino da ficha do aluno"
        >
          {removendo ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Remover
        </button>
      </div>

      {realocados.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
          <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>{realocados.map(fraseRealocacao).join("; ")}.</span>
        </p>
      )}

      {editando && (
        <div className="mt-3 border-t border-ink-700 pt-3">
          <SeletorDiasTreino value={dias} onChange={setDias} disabled={salvando} />
          {erro && <p className="mt-2 text-xs text-red-300">{erro}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex items-center gap-1.5 rounded-lg bg-volt-300 px-3 py-1.5 text-xs font-semibold text-ink-950 transition disabled:opacity-60"
            >
              {salvando ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Salvar dias
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
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
