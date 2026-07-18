"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Video, Zap } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";
import { CatalogoExercicio, GRUPOS_MUSCULARES, GrupoMuscular } from "@/lib/types";
import { cn } from "@/lib/utils";

export type LinhaExercicio = {
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  imagem_demonstracao_url: string;
  video_demonstracao_url: string;
};

const VAZIO: LinhaExercicio = {
  nome_exercicio: "",
  series: 3,
  repeticoes: "12",
  carga_kg: 0,
  imagem_demonstracao_url: "",
  video_demonstracao_url: "",
};

/**
 * Construtor de exercícios reutilizável. Publica a lista em um input oculto
 * (name="exercicios_json") para envio via Server Action. Com o catálogo,
 * mostra botões por grupo muscular (Peito, Costas...) para montar o treino
 * com 1 clique — os exercícios já vêm com séries/reps padrão e a animação
 * (quando disponível). Também é possível adicionar exercícios manualmente.
 */
export default function ExercicioBuilder({
  catalogo = [],
  iniciais = [],
}: {
  catalogo?: CatalogoExercicio[];
  iniciais?: LinhaExercicio[];
}) {
  const [exercicios, setExercicios] = useState<LinhaExercicio[]>(iniciais);
  const [grupoAberto, setGrupoAberto] = useState<GrupoMuscular | null>(null);

  const setEx = (i: number, patch: Partial<LinhaExercicio>) =>
    setExercicios((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );
  const add = (base: LinhaExercicio = { ...VAZIO }) =>
    setExercicios((p) => [...p, base]);
  const rm = (i: number) => setExercicios((p) => p.filter((_, idx) => idx !== i));

  const gruposComItens = useMemo(() => {
    const disponiveis = new Set(catalogo.map((c) => c.grupo_muscular));
    return GRUPOS_MUSCULARES.filter((g) => disponiveis.has(g.value));
  }, [catalogo]);

  const itensDoGrupo = useMemo(
    () =>
      grupoAberto ? catalogo.filter((c) => c.grupo_muscular === grupoAberto) : [],
    [catalogo, grupoAberto]
  );

  const adicionarDoCatalogo = (item: CatalogoExercicio) => {
    add({
      nome_exercicio: item.nome,
      series: item.series_padrao,
      repeticoes: item.repeticoes_padrao,
      carga_kg: 0,
      imagem_demonstracao_url: item.imagem_demonstracao_url ?? "",
      video_demonstracao_url: item.video_demonstracao_url ?? "",
    });
  };

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="exercicios_json"
        value={JSON.stringify(exercicios)}
      />

      {/* Montagem rápida por grupo muscular */}
      {gruposComItens.length > 0 && (
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-400">
            Adicionar por grupo muscular
          </span>
          <div className="flex flex-wrap gap-2">
            {gruposComItens.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() =>
                  setGrupoAberto((atual) => (atual === g.value ? null : g.value))
                }
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  grupoAberto === g.value
                    ? "bg-volt-300 text-ink-950"
                    : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
                )}
              >
                {g.label}
              </button>
            ))}
          </div>

          {grupoAberto && (
            <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-ink-600 bg-ink-900/50 p-3">
              {itensDoGrupo.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => adicionarDoCatalogo(item)}
                  className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-volt-500/50 hover:bg-ink-700"
                >
                  {item.video_demonstracao_url && (
                    <Video className="h-3 w-3 text-volt-300" />
                  )}
                  {item.nome}
                  <Plus className="h-3 w-3 text-slate-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {exercicios.length === 0 && (
        <p className="rounded-xl border border-dashed border-ink-600 px-4 py-6 text-center text-sm text-slate-500">
          Nenhum exercício ainda — escolha um grupo muscular acima ou adicione
          manualmente.
        </p>
      )}

      {exercicios.map((ex, i) => (
        <div key={i} className="rounded-xl border border-ink-600 bg-ink-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {ex.video_demonstracao_url && (
                <Zap className="h-3 w-3 text-volt-300" />
              )}
              Exercício {i + 1}
            </span>
            <button
              type="button"
              onClick={() => rm(i)}
              className="text-slate-500 transition hover:text-red-400"
              aria-label="Remover exercício"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_minmax(0,180px)]">
            <div className="space-y-3">
              <input
                value={ex.nome_exercicio}
                onChange={(e) => setEx(i, { nome_exercicio: e.target.value })}
                placeholder="Nome do exercício (ex: Supino reto)"
                className="inp"
              />
              <div className="grid grid-cols-3 gap-2">
                <Campo label="Séries">
                  <input
                    type="number"
                    min={0}
                    value={ex.series}
                    onChange={(e) => setEx(i, { series: Number(e.target.value) })}
                    className="inp"
                  />
                </Campo>
                <Campo label="Reps">
                  <input
                    value={ex.repeticoes}
                    onChange={(e) => setEx(i, { repeticoes: e.target.value })}
                    placeholder="10-12"
                    className="inp"
                  />
                </Campo>
                <Campo label="Carga (kg)">
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={ex.carga_kg}
                    onChange={(e) => setEx(i, { carga_kg: Number(e.target.value) })}
                    className="inp"
                  />
                </Campo>
              </div>
              <Campo label="Vídeo de demonstração (≤ 10s)">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 flex-none text-volt-300" />
                  <input
                    type="url"
                    value={ex.video_demonstracao_url}
                    onChange={(e) =>
                      setEx(i, { video_demonstracao_url: e.target.value })
                    }
                    placeholder="URL do clipe (mp4/webm)"
                    className="inp"
                  />
                </div>
              </Campo>
            </div>

            <ImageUpload
              value={ex.imagem_demonstracao_url}
              onChange={(url) => setEx(i, { imagem_demonstracao_url: url })}
              aspect="aspect-[4/3]"
              hint="Imagem do movimento"
            />
          </div>
        </div>
      ))}

      <button type="button" onClick={() => add()} className="btn-ghost w-full">
        <Plus className="h-4 w-4" /> Adicionar exercício manualmente
      </button>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
      </span>
      {children}
    </label>
  );
}
