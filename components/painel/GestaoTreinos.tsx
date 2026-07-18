"use client";

import { useEffect, useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { Dumbbell, Layers, Plus, Share2, Target } from "lucide-react";
import { CatalogoExercicio, Treino } from "@/lib/types";
import { cn } from "@/lib/utils";
import FormActions from "@/components/ui/FormActions";
import ConfirmButton from "@/components/ui/ConfirmButton";
import ExercicioBuilder from "@/components/painel/ExercicioBuilder";
import CompartilharTreino from "@/components/painel/CompartilharTreino";
import {
  criarTreinoBiblioteca,
  excluirTreinoBiblioteca,
} from "@/app/painel/[slug]/treinos/actions";

const MODALIDADES_SUGERIDAS = [
  "Musculação",
  "Funcional",
  "Crossfit",
  "Hipertrofia",
  "Emagrecimento",
  "Iniciante",
];

export default function GestaoTreinos({
  slug,
  treinosIniciais,
  catalogo,
}: {
  slug: string;
  treinosIniciais: Treino[];
  catalogo: CatalogoExercicio[];
}) {
  const treinos = treinosIniciais;
  const [mostrarForm, setMostrarForm] = useState(treinos.length === 0);

  // Agrupa por modalidade.
  const grupos = useMemo(() => {
    const map = new Map<string, Treino[]>();
    for (const t of treinos) {
      const k = t.modalidade?.trim() || "Sem modalidade";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    return Array.from(map.entries());
  }, [treinos]);

  return (
    <div className="space-y-6">
      <button
        onClick={() => setMostrarForm((v) => !v)}
        className={mostrarForm ? "btn-ghost" : "btn-volt"}
      >
        <Plus className="h-4 w-4" />
        {mostrarForm ? "Fechar formulário" : "Novo treino"}
      </button>

      {mostrarForm && (
        <FormularioTreino
          slug={slug}
          catalogo={catalogo}
          onSalvo={() => setMostrarForm(false)}
        />
      )}

      {treinos.length === 0 && !mostrarForm ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Nenhum treino na biblioteca ainda. Crie o primeiro (ex: “Treino A -
          Peito e Tríceps”) e compartilhe por QR.
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(([modalidade, lista]) => (
            <section key={modalidade} className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-400">
                <Layers className="h-4 w-4 text-volt-300" /> {modalidade}
                <span className="text-slate-600">({lista.length})</span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {lista.map((t) => (
                  <CardTreino key={t.id} slug={slug} treino={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function CardTreino({ slug, treino }: { slug: string; treino: Treino }) {
  return (
    <div className="surface flex flex-col rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-white">{treino.nome_treino}</h3>
          {treino.objetivo && (
            <span className="chip mt-2 border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
              <Target className="h-3.5 w-3.5" /> {treino.objetivo}
            </span>
          )}
        </div>
        {treino.publico && (
          <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
            <Share2 className="h-3 w-3" /> público
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {treino.exercicios?.length ?? 0} exercícios
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(treino.exercicios ?? []).slice(0, 6).map((ex) => (
          <span
            key={ex.id}
            className="chip border-ink-600 bg-ink-700/60 text-slate-300"
          >
            {ex.nome_exercicio}
          </span>
        ))}
        {(treino.exercicios?.length ?? 0) > 6 && (
          <span className="chip border-ink-600 bg-ink-700/60 text-slate-400">
            +{(treino.exercicios?.length ?? 0) - 6}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-ink-700 pt-4">
        <CompartilharTreino slug={slug} treino={treino} />
        <div className="ml-auto">
          <ConfirmButton
            action={() => excluirTreinoBiblioteca(slug, treino.id)}
            confirmText={`Excluir o treino "${treino.nome_treino}"?`}
            label="Excluir treino"
          />
        </div>
      </div>
    </div>
  );
}

function FormularioTreino({
  slug,
  catalogo,
  onSalvo,
}: {
  slug: string;
  catalogo: CatalogoExercicio[];
  onSalvo: () => void;
}) {
  const acao = criarTreinoBiblioteca.bind(null, slug);
  const [estado, formAction] = useFormState(acao, {});
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (estado.ok) {
      setResetKey((k) => k + 1);
      onSalvo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 font-semibold text-white">
        <Dumbbell className="h-4 w-4 text-volt-300" /> Novo treino
      </h2>

      {estado.erro && (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Nome do treino
          </span>
          <input
            name="nome_treino"
            placeholder="Ex: Treino A - Peito e Tríceps"
            className="inp"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Modalidade
          </span>
          <input
            name="modalidade"
            list="modalidades-sugeridas"
            placeholder="Ex: Musculação"
            className="inp"
          />
          <datalist id="modalidades-sugeridas">
            {MODALIDADES_SUGERIDAS.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">
            Objetivo
          </span>
          <input
            name="objetivo"
            placeholder="Ex: Hipertrofia"
            className="inp"
          />
        </label>
      </div>

      <div className="mt-4">
        <ExercicioBuilder key={resetKey} catalogo={catalogo} />
      </div>

      <FormActions salvarLabel="Salvar treino" className="mt-4" />
    </form>
  );
}
