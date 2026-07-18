"use client";

import { useState } from "react";
import { Plus, Trash2, Video } from "lucide-react";
import ImageUpload from "@/components/ui/ImageUpload";

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
 * (name="exercicios_json") para envio via Server Action.
 */
export default function ExercicioBuilder() {
  const [exercicios, setExercicios] = useState<LinhaExercicio[]>([{ ...VAZIO }]);

  const setEx = (i: number, patch: Partial<LinhaExercicio>) =>
    setExercicios((prev) =>
      prev.map((ex, idx) => (idx === i ? { ...ex, ...patch } : ex))
    );
  const add = () => setExercicios((p) => [...p, { ...VAZIO }]);
  const rm = (i: number) =>
    setExercicios((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  return (
    <div className="space-y-4">
      <input type="hidden" name="exercicios_json" value={JSON.stringify(exercicios)} />

      {exercicios.map((ex, i) => (
        <div key={i} className="rounded-xl border border-ink-600 bg-ink-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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

      <button type="button" onClick={add} className="btn-ghost w-full">
        <Plus className="h-4 w-4" /> Adicionar exercício
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
