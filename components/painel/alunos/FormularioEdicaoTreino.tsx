"use client";

import { useEffect } from "react";
import { useFormState } from "react-dom";
import { Target } from "lucide-react";
import { CatalogoExercicio, Treino } from "@/lib/types";
import FormActions from "@/components/ui/FormActions";
import ExercicioBuilder, {
  type LinhaExercicio,
} from "@/components/painel/ExercicioBuilder";
import { atualizarTreino } from "@/app/painel/[slug]/alunos/actions";
import Field from "./Field";

export default function FormularioEdicaoTreino({
  slug,
  treino,
  exercicios,
  catalogo,
  onSalvo,
}: {
  slug: string;
  treino: Treino;
  exercicios: Treino["exercicios"];
  catalogo: CatalogoExercicio[];
  onSalvo: () => void;
}) {
  const acao = atualizarTreino.bind(null, slug, treino.id);
  const [estado, formAction] = useFormState(acao, {});

  useEffect(() => {
    if (estado.ok) onSalvo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.savedAt]);

  // Converte o que está salvo no banco para as linhas do construtor.
  const iniciais: LinhaExercicio[] = (exercicios ?? []).map((ex) => ({
    nome_exercicio: ex.nome_exercicio,
    series: ex.series,
    repeticoes: ex.repeticoes,
    carga_kg: ex.carga_kg ?? 0,
    descanso_segundos: ex.descanso_segundos ?? 0,
    observacoes: ex.observacoes ?? "",
    imagem_demonstracao_url: ex.imagem_demonstracao_url ?? "",
    video_demonstracao_url: ex.video_demonstracao_url ?? "",
  }));

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
            name="nome_treino"
            defaultValue={treino.nome_treino}
            className="inp"
            required
          />
        </Field>
        <Field label="Objetivo">
          <div className="relative">
            <Target className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              name="objetivo"
              defaultValue={treino.objetivo ?? ""}
              placeholder="Ex: Hipertrofia"
              className="inp pl-9"
            />
          </div>
        </Field>
      </div>

      <ExercicioBuilder slug={slug} catalogo={catalogo} iniciais={iniciais} />

      <FormActions salvarLabel="Salvar alterações" />
    </form>
  );
}
