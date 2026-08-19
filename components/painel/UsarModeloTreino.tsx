"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, Loader2, Search, X } from "lucide-react";
import { atribuirModelosTreino } from "@/app/painel/[slug]/treinos/actions";

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
            : "Atribuir um ou vários treinos da biblioteca de uma vez"
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

type Resultado = {
  criados: number;
  ignorados: number;
  falhas: { nome: string; motivo: string }[];
};

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
  // Seleção múltipla: a "caixinha" pedida pela recepção para marcar o ABC e
  // atribuir tudo de uma vez. A ordem de marcação vira a ordem na ficha.
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
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

  const alternar = (id: string) => {
    setErro("");
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]
    );
  };

  const atribuir = () => {
    if (selecionados.length === 0) {
      setErro("Marque pelo menos um treino da biblioteca.");
      return;
    }

    startTransition(async () => {
      const r = await atribuirModelosTreino(slug, alunoId, selecionados);
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }

      // Nada criado e nada falhou = o aluno já tinha tudo que foi marcado.
      if (r.criados === 0 && r.falhas.length === 0) {
        setErro(
          r.ignorados > 0
            ? "Esse aluno já tinha os treinos marcados — nada a fazer."
            : "Nenhum treino foi atribuído."
        );
        return;
      }

      setResultado({
        criados: r.criados,
        ignorados: r.ignorados,
        falhas: r.falhas,
      });
      router.refresh();
      // Se tudo deu certo, fecha sozinho. Se houve ignorados/falhas, deixa o
      // resumo na tela para a recepção ler (fecha no botão).
      if (r.ignorados === 0 && r.falhas.length === 0) {
        window.setTimeout(onClose, 1100);
      }
    });
  };

  const total = selecionados.length;

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
            Marque um ou vários treinos para atribuir a {alunoNome} de uma vez.
          </p>
        </div>

        {resultado ? (
          <ResumoAtribuicao
            resultado={resultado}
            alunoNome={alunoNome}
            onFechar={onClose}
          />
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-volt-500/20 bg-volt-500/5 px-3 py-2 text-xs text-slate-300">
              De cada treino marcado o sistema cria uma cópia independente na
              ficha. Depois você ajusta exercícios, cargas e dias só para este
              aluno.
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
                  const marcado = selecionados.includes(modelo.id);
                  return (
                    <label
                      key={modelo.id}
                      className={`flex w-full cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        marcado
                          ? "border-volt-500/50 bg-volt-500/10"
                          : "border-ink-600 bg-ink-900/50 hover:border-ink-500"
                      }`}
                    >
                      {/* Caixinha visual de seleção (o pedido literal do cliente). */}
                      <span
                        className={`mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border transition ${
                          marcado
                            ? "border-volt-400 bg-volt-400 text-ink-950"
                            : "border-ink-500 bg-ink-900"
                        }`}
                        aria-hidden="true"
                      >
                        {marcado && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={marcado}
                        onChange={() => alternar(modelo.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-white">
                          {modelo.nome_treino}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {modelo.total_exercicios} exercícios
                          {modelo.profissional_nome
                            ? ` · por ${modelo.profissional_nome}`
                            : ""}
                        </span>
                        {(modelo.objetivo ||
                          modelo.nivel ||
                          modelo.publico_alvo) && (
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
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            {erro && (
              <p className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {erro}
              </p>
            )}

            <div className="mt-5 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {total === 0
                  ? "Nenhum treino marcado"
                  : `${total} treino${total > 1 ? "s" : ""} marcado${
                      total > 1 ? "s" : ""
                    }`}
              </span>
              <div className="flex gap-2">
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
                  disabled={total === 0 || pending}
                  className="btn-volt"
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Dumbbell className="h-4 w-4" />
                  )}
                  {pending
                    ? "Atribuindo..."
                    : total > 1
                      ? `Atribuir ${total} treinos`
                      : "Atribuir treino"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Resumo pós-atribuição: quantos entraram, quantos já existiam e o que falhou. */
function ResumoAtribuicao({
  resultado,
  alunoNome,
  onFechar,
}: {
  resultado: Resultado;
  alunoNome: string;
  onFechar: () => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      {resultado.criados > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-volt-500/30 bg-volt-500/10 px-3 py-2 text-sm text-volt-200">
          <Check className="mt-0.5 h-4 w-4 flex-none" />
          {resultado.criados === 1
            ? `1 treino atribuído a ${alunoNome} — o aluno já foi avisado no app dele.`
            : `${resultado.criados} treinos atribuídos a ${alunoNome} — o aluno já foi avisado no app dele.`}
        </p>
      )}

      {resultado.ignorados > 0 && (
        <p className="rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2 text-xs text-slate-400">
          {resultado.ignorados === 1
            ? "1 treino já estava na ficha e foi ignorado (nada duplicado)."
            : `${resultado.ignorados} treinos já estavam na ficha e foram ignorados (nada duplicado).`}
        </p>
      )}

      {resultado.falhas.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <p className="font-medium">
            {resultado.falhas.length === 1
              ? "1 treino não pôde ser atribuído:"
              : `${resultado.falhas.length} treinos não puderam ser atribuídos:`}
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {resultado.falhas.map((f, i) => (
              <li key={i}>
                <span className="font-medium">{f.nome}</span> — {f.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={onFechar} className="btn-volt">
          <Check className="h-4 w-4" /> Concluir
        </button>
      </div>
    </div>
  );
}
