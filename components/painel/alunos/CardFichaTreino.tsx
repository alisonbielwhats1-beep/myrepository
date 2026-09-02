"use client";

import { useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  Pencil,
  Video,
} from "lucide-react";
import { CatalogoExercicio, Treino } from "@/lib/types";
import { cn } from "@/lib/utils";
import ConfirmButton from "@/components/ui/ConfirmButton";
import { excluirTreino } from "@/app/painel/[slug]/alunos/actions";
import { definirDiasTreino } from "@/app/painel/[slug]/treinos/actions";
import SeletorDiasTreino from "@/components/painel/SeletorDiasTreino";
import {
  DiaSemana,
  fraseRealocacao,
  normalizarDias,
  resumoDias,
  type FichaRealocada,
} from "@/lib/dias-semana";
import FormularioEdicaoTreino from "./FormularioEdicaoTreino";

// ---------------------------------------------------------------------------
// Formulário de nova ficha de treino
// ---------------------------------------------------------------------------
/**
 * Ficha já montada: resumo dos exercícios e, ao clicar em "Editar", o mesmo
 * construtor usado na criação — agora pré-preenchido com o que está salvo.
 *
 * Antes só existia "Excluir": para trocar um vídeo ou corrigir uma carga o
 * professor precisava apagar a ficha e remontar tudo. A mídia de cada
 * exercício aparece como miniatura para ele conferir, sem abrir a edição, se
 * a foto e o vídeo realmente foram salvos.
 */
export default function CardFichaTreino({
  slug,
  treino,
  catalogo,
}: {
  slug: string;
  treino: Treino;
  catalogo: CatalogoExercicio[];
}) {
  const [editando, setEditando] = useState(false);
  // Minimizado por padrão: com várias fichas na tela, a lista inteira de
  // exercícios de cada uma deixava a ficha do aluno comprida demais pra só
  // ver "quais treinos ele tem". Abre sob demanda.
  const [expandido, setExpandido] = useState(false);
  const [dias, setDias] = useState<DiaSemana[]>(() =>
    normalizarDias(treino.dias_semana)
  );
  const [editandoDias, setEditandoDias] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<DiaSemana[]>(dias);
  const [salvandoDias, setSalvandoDias] = useState(false);
  const [erroDias, setErroDias] = useState<string | null>(null);
  const [realocados, setRealocados] = useState<FichaRealocada[]>([]);
  const exercicios = [...(treino.exercicios ?? [])].sort(
    (a, b) => a.ordem - b.ordem
  );

  function abrirEdicaoDias() {
    setDiasSelecionados(dias);
    setErroDias(null);
    setEditandoDias(true);
  }

  async function salvarDias() {
    setSalvandoDias(true);
    setErroDias(null);
    const r = await definirDiasTreino(slug, treino.id, diasSelecionados);
    setSalvandoDias(false);
    if ("erro" in r) {
      setErroDias(r.erro);
      return;
    }
    setDias(r.dias as DiaSemana[]);
    setEditandoDias(false);
    // Cada dia é um slot exclusivo por aluno: se essa troca tirou o dia de
    // outra ficha dele, avisa aqui em vez de acontecer calado.
    setRealocados(r.realocados);
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-white">{treino.nome_treino}</p>
          {(treino.modelo_origem_id || treino.profissional_nome) && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {treino.modelo_origem_id ? "Da biblioteca" : "Ficha personalizada"}
              {treino.profissional_nome
                ? ` · por ${treino.profissional_nome}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {treino.objetivo && (
            <span className="chip border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
              {treino.objetivo}
            </span>
          )}
          {/* Dia(s) da ficha — mesmo dado usado no filtro "por dia" do app do
              aluno (TreinosDia), só que aqui, visível na ficha do aluno, é
              onde o dono realmente olha quando quer saber a semana dele. */}
          <button
            type="button"
            onClick={abrirEdicaoDias}
            title="Alterar os dias desta ficha"
            className={cn(
              "chip cursor-pointer transition-opacity hover:opacity-80",
              dias.length > 0
                ? "border-ink-600 bg-ink-800 text-slate-300"
                : "border-dashed border-ink-600 bg-transparent text-slate-500"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {resumoDias(dias)}
          </button>
          <button
            type="button"
            onClick={() => setEditando((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs font-semibold text-slate-200 transition hover:border-volt-500/50 hover:bg-ink-700"
          >
            <Pencil className="h-3 w-3 text-volt-300" />
            {editando ? "Cancelar" : "Editar"}
          </button>
          <ConfirmButton
            action={() => excluirTreino(slug, treino.id)}
            confirmText={`Excluir a ficha "${treino.nome_treino}"?`}
            label="Excluir ficha"
          />
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            aria-expanded={expandido}
            aria-label={expandido ? "Recolher ficha" : "Expandir ficha"}
            title={expandido ? "Recolher ficha" : "Expandir ficha"}
            className="grid h-7 w-7 flex-none place-items-center rounded-lg text-slate-400 transition hover:bg-ink-700 hover:text-white"
          >
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                expandido && "rotate-180"
              )}
            />
          </button>
        </div>
      </div>

      {realocados.length > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
          <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>{realocados.map(fraseRealocacao).join("; ")}.</span>
        </p>
      )}

      {editandoDias && (
        <div className="mt-3 rounded-lg border border-ink-600 bg-ink-800/60 p-3">
          <SeletorDiasTreino
            value={diasSelecionados}
            onChange={setDiasSelecionados}
            disabled={salvandoDias}
          />
          {erroDias && <p className="mt-2 text-xs text-red-400">{erroDias}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={salvarDias}
              disabled={salvandoDias}
              className="inline-flex items-center gap-1.5 rounded-lg bg-volt-300 px-3 py-1.5 text-xs font-semibold text-ink-950 transition disabled:opacity-60"
            >
              {salvandoDias ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Salvar dias
            </button>
            <button
              type="button"
              onClick={() => setEditandoDias(false)}
              disabled={salvandoDias}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {editando ? (
        <FormularioEdicaoTreino
          slug={slug}
          treino={treino}
          exercicios={exercicios}
          catalogo={catalogo}
          onSalvo={() => setEditando(false)}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="mt-1 text-xs text-slate-500 transition hover:text-slate-300"
          >
            {exercicios.length} exercícios{expandido ? "" : " — toque pra ver"}
          </button>
          {expandido && (
            <div className="mt-3 space-y-1.5">
              {exercicios.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-2 text-xs text-slate-300"
                >
                  {/* Miniatura: confirma visualmente que a mídia foi salva. */}
                  {ex.video_demonstracao_url ? (
                    <span className="inline-flex flex-none items-center gap-1 rounded bg-volt-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-volt-300">
                      <Video className="h-3 w-3" /> vídeo
                    </span>
                  ) : (
                    <span className="w-[52px] flex-none" />
                  )}
                  {ex.imagem_demonstracao_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={ex.imagem_demonstracao_url}
                      alt=""
                      className="h-6 w-6 flex-none rounded object-cover"
                    />
                  ) : (
                    <span className="h-6 w-6 flex-none rounded bg-ink-700" />
                  )}
                  <span className="truncate">
                    {ex.nome_exercicio} · {ex.series}x{ex.repeticoes}
                    {ex.carga_kg ? ` · ${ex.carga_kg}kg` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
