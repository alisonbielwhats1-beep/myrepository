"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Target } from "lucide-react";
import { CatalogoExercicio } from "@/lib/types";
import FormActions from "@/components/ui/FormActions";
import ExercicioBuilder from "@/components/painel/ExercicioBuilder";
import { criarTreino } from "@/app/painel/[slug]/alunos/actions";
import Field from "./Field";

export default function FormularioTreino({
  slug,
  alunoId,
  proximaOrdem,
  catalogo,
}: {
  slug: string;
  alunoId: string;
  proximaOrdem: number;
  catalogo: CatalogoExercicio[];
}) {
  const acao = criarTreino.bind(null, slug, alunoId);
  const [estado, formAction] = useFormState(acao, {});
  const [nomeTreino, setNomeTreino] = useState("");
  const [objetivo, setObjetivo] = useState("Hipertrofia");
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (estado.ok) {
      setNomeTreino("");
      setObjetivo("Hipertrofia");
      setResetKey((k) => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  return (
    <form action={formAction} className="mt-4 space-y-4">
      {estado.erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {estado.erro}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome do treino">
          <input
            value={nomeTreino}
            onChange={(e) => setNomeTreino(e.target.value)}
            name="nome_treino"
            placeholder={`Ex: Treino ${String.fromCharCode(64 + proximaOrdem)} - Peito e Tríceps`}
            className="inp"
            required
          />
        </Field>
        <Field label="Objetivo">
          <div className="relative">
            <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              name="objetivo"
              placeholder="Ex: Hipertrofia"
              className="inp pl-9"
            />
          </div>
        </Field>
      </div>

      <ExercicioBuilder key={resetKey} slug={slug} catalogo={catalogo} />

      <FormActions salvarLabel="Salvar ficha de treino" />
    </form>
  );
}
