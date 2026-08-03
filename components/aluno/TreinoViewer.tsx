"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Clock3, PlayCircle, RotateCcw, Target } from "lucide-react";
import { FichaTreinoPublico, ProgressoExercicio, SessaoTreino } from "@/lib/types";
import { cn } from "@/lib/utils";
import CreditoVideosExercicios from "./CreditoVideosExercicios";
import ExercicioCard from "./ExercicioCard";

type EstadoSessao = { erro?: string; sessao?: SessaoTreino };
type EstadoProgresso = { erro?: string; progresso?: ProgressoExercicio[] };

type Acoes = {
  iniciar: (treinoId: string) => Promise<EstadoSessao>;
  salvarProgresso: (
    sessaoId: string,
    progresso: ProgressoExercicio[]
  ) => Promise<EstadoProgresso>;
  finalizar: (sessaoId: string) => Promise<EstadoSessao>;
};

export default function TreinoViewer({
  treinos,
  sessoesAtivas,
  ...acoes
}: {
  treinos: FichaTreinoPublico[];
  sessoesAtivas: SessaoTreino[];
} & Acoes) {
  const [ativo, setAtivo] = useState(0);

  if (treinos.length === 0) {
    return (
      <div className="surface rounded-2xl p-8 text-center text-slate-400">
        Nenhum treino atribuído ainda. Fale com a recepção da sua academia.
      </div>
    );
  }

  const treino = treinos[ativo];
  const sessaoAtiva = sessoesAtivas.find((s) => s.treino_id === treino.id) ?? null;

  return (
    <div className="space-y-5">
      {/* Seletor de fichas (Treino A / B / C) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {treinos.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setAtivo(i)}
            className={cn(
              "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
              i === ativo
                ? "bg-volt-300 text-ink-950 shadow-glow"
                : "border border-ink-600 bg-ink-800 text-slate-300 hover:bg-ink-700"
            )}
          >
            {t.nome_treino.split(" - ")[0] || t.nome_treino}
          </button>
        ))}
      </div>

      {/* `key={treino.id}` força um remount completo ao trocar de ficha — sem
          isso, o estado de sessão de um treino podia vazar para outro (mesma
          classe de bug já corrigida no acesso do aluno: estado local
          copiado de props precisa de key quando o id muda). */}
      <ExecucaoTreino key={treino.id} treino={treino} sessaoInicial={sessaoAtiva} {...acoes} />
    </div>
  );
}

function ExecucaoTreino({
  treino,
  sessaoInicial,
  iniciar,
  salvarProgresso,
  finalizar,
}: {
  treino: FichaTreinoPublico;
  sessaoInicial: SessaoTreino | null;
} & Acoes) {
  const [sessao, setSessao] = useState<SessaoTreino | null>(sessaoInicial);
  const [resumo, setResumo] = useState<SessaoTreino | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pending, startTransition] = useTransition();

  const exercicios = [...(treino.exercicios ?? [])].sort((a, b) => a.ordem - b.ordem);

  const handleIniciar = () => {
    setErro(null);
    startTransition(async () => {
      const r = await iniciar(treino.id);
      if (r.erro || !r.sessao) {
        setErro(r.erro ?? "Não foi possível iniciar o treino.");
        return;
      }
      setSessao(r.sessao);
    });
  };

  const handleAlterar = (
    exercicioId: string,
    patch: Partial<Omit<ProgressoExercicio, "exercicio_id">>
  ) => {
    if (!sessao) return;
    const atual = sessao.progresso.find((p) => p.exercicio_id === exercicioId);
    const novoItem: ProgressoExercicio = {
      exercicio_id: exercicioId,
      concluido: atual?.concluido ?? false,
      carga_realizada_kg: atual?.carga_realizada_kg ?? 0,
      repeticoes_realizadas: atual?.repeticoes_realizadas ?? "",
      ...patch,
    };
    const novoProgresso = [
      ...sessao.progresso.filter((p) => p.exercicio_id !== exercicioId),
      novoItem,
    ];

    // Otimista: a interface reflete a alteração na hora; o servidor confirma
    // (ou reporta erro) em seguida, sem travar a tela a cada toque.
    //
    // Em caso de erro, NÃO voltamos para um snapshot anterior: se outra
    // alteração mais recente já tiver sido salva com sucesso enquanto esta
    // estava em voo, reverter para o snapshot capturado aqui apagaria essa
    // mudança mais nova. Como cada chamada sempre envia o array de progresso
    // INTEIRO (não um diff), a próxima gravação bem-sucedida já reconcilia
    // tudo — mantemos o estado otimista e só avisamos que algo pode não ter
    // persistido.
    setSessao({ ...sessao, progresso: novoProgresso });
    setSalvando(true);
    startTransition(async () => {
      const r = await salvarProgresso(sessao.id, novoProgresso);
      setSalvando(false);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      setErro(null);
    });
  };

  const handleFinalizar = () => {
    if (!sessao) return;
    setErro(null);
    startTransition(async () => {
      const r = await finalizar(sessao.id);
      if (r.erro || !r.sessao) {
        setErro(r.erro ?? "Não foi possível finalizar o treino.");
        return;
      }
      setResumo(r.sessao);
      setSessao(null);
    });
  };

  // --- Resumo pós-finalização ---------------------------------------------
  if (resumo) {
    const totalConcluidos = resumo.progresso.filter((p) => p.concluido).length;
    const duracaoMin = resumo.finalizado_em
      ? Math.max(
          1,
          Math.round(
            (new Date(resumo.finalizado_em).getTime() -
              new Date(resumo.iniciado_em).getTime()) /
              60000
          )
        )
      : null;

    return (
      <div className="surface flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-volt-500/15 text-volt-300">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h2 className="text-lg font-bold text-white">Treino concluído</h2>
        <p className="text-sm text-slate-400">
          {totalConcluidos} de {exercicios.length} exercícios marcados como
          concluídos
          {duracaoMin != null && ` · ${duracaoMin} min`}
        </p>
        <button onClick={() => setResumo(null)} className="btn-volt mt-2">
          Fazer este treino novamente
        </button>
      </div>
    );
  }

  // --- Antes de iniciar ----------------------------------------------------
  if (!sessao) {
    return (
      <div className="space-y-4">
        <div className="surface rounded-2xl p-4">
          <h2 className="text-lg font-bold text-white">{treino.nome_treino}</h2>
          {treino.objetivo && (
            <span className="chip mt-2 border-magenta-500/30 bg-magenta-500/10 text-magenta-400">
              <Target className="h-3.5 w-3.5" /> {treino.objetivo}
            </span>
          )}
          <p className="mt-2 text-sm text-slate-400">
            {exercicios.length} exercícios
          </p>
        </div>

        {erro && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {erro}
          </p>
        )}

        <button
          onClick={handleIniciar}
          disabled={pending || exercicios.length === 0}
          className="btn-volt w-full disabled:opacity-50"
        >
          <PlayCircle className="h-4 w-4" />
          {pending ? "Iniciando..." : "Iniciar treino"}
        </button>
      </div>
    );
  }

  // --- Em andamento (ou retomado) ------------------------------------------
  const progressoPorExercicio = new Map(sessao.progresso.map((p) => [p.exercicio_id, p]));
  const concluidos = sessao.progresso.filter((p) => p.concluido).length;

  return (
    <div className="space-y-4">
      <div className="surface flex items-center justify-between rounded-2xl p-4">
        <div>
          <h2 className="text-lg font-bold text-white">{treino.nome_treino}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
            <Clock3 className="h-3.5 w-3.5" />
            {concluidos} de {exercicios.length} concluídos
            {salvando && <span className="text-slate-500"> · salvando...</span>}
          </p>
        </div>
        <RotateCcw className="h-5 w-5 text-slate-600" />
      </div>

      {erro && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {erro}
        </p>
      )}

      <div className="space-y-4">
        {exercicios.map((ex) => (
          <ExercicioCard
            key={ex.id}
            ex={ex}
            progresso={progressoPorExercicio.get(ex.id)}
            onAlterar={(patch) => handleAlterar(ex.id, patch)}
          />
        ))}
      </div>

      <button
        onClick={handleFinalizar}
        disabled={pending}
        className="btn-volt w-full disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" />
        {pending ? "Finalizando..." : "Finalizar treino"}
      </button>

      <CreditoVideosExercicios exercicios={exercicios} />
    </div>
  );
}
