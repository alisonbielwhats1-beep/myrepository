import TreinosDia from "@/components/aluno/TreinosDia";
import { diasTreinadosNaSemana, requireFichaAluno } from "@/lib/aluno-publico";
import {
  getFrequenciaAlunoPublico,
  getRecordesAluno,
  getResumoEvolucaoAluno,
  getSessoesAtivasTreino,
  getTreinosSugeridosAluno,
  getUltimaCargaAluno,
  getUltimaExecucaoAluno,
} from "@/lib/data";
import { ROTULO_DIA_LONGO, diaSemanaHojeSaoPaulo } from "@/lib/dias-semana";
import { sugestoesDeCarga } from "@/lib/progressao-carga";
import {
  finalizarSessaoTreino,
  iniciarSessaoTreino,
  salvarProgressoTreino,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function TreinosPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const [
    sessoesAtivas,
    recordes,
    acessos,
    ultimaCarga,
    ultimaExecucao,
    evolucao,
    sugeridos,
  ] = await Promise.all([
      getSessoesAtivasTreino(params.token, params.slug),
      getRecordesAluno(params.token, params.slug),
      getFrequenciaAlunoPublico(params.token, params.slug),
      getUltimaCargaAluno(params.token, params.slug),
      getUltimaExecucaoAluno(params.token, params.slug),
      getResumoEvolucaoAluno(params.token, params.slug),
      // Só o SE existem, não o conteúdo: a lista completa é carregada na tela
      // de sugeridos. Aqui serve para não oferecer um atalho que leva a nada.
      getTreinosSugeridosAluno(params.token, params.slug),
    ]);

  const hoje = diaSemanaHojeSaoPaulo();
  // Dias já treinados nesta semana — alimentam o status "feito" da trilha.
  const diasFeitos = diasTreinadosNaSemana(acessos);

  // Sugestão de carga: decidida no servidor, uma vez, a partir do esforço que
  // o próprio aluno registrou. Vem vazia enquanto a migration 107 não estiver
  // aplicada — e aí a tela fica exatamente como era.
  const sugestoes = sugestoesDeCarga(ultimaExecucao);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-400">Seu treino</p>
          <h1 className="text-2xl font-bold text-white">Treinos</h1>
        </div>
        <span className="chip border-ink-600 bg-ink-800 text-slate-300">
          {ROTULO_DIA_LONGO[hoje]}
        </span>
      </header>

      <TreinosDia
        treinos={ficha.treinos}
        sessoesAtivas={sessoesAtivas}
        recordes={recordes}
        ultimaCarga={ultimaCarga}
        sugestoes={sugestoes}
        evolucao={evolucao}
        diasFeitos={diasFeitos}
        base={`/aluno/${params.slug}/${params.token}`}
        temSugeridos={sugeridos.length > 0}
        iniciar={iniciarSessaoTreino.bind(null, params.slug, params.token)}
        salvarProgresso={salvarProgressoTreino.bind(null, params.slug, params.token)}
        finalizar={finalizarSessaoTreino.bind(null, params.slug, params.token)}
      />
    </div>
  );
}
