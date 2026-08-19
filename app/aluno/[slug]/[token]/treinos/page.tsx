import TreinosDia from "@/components/aluno/TreinosDia";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getRecordesAluno, getSessoesAtivasTreino } from "@/lib/data";
import { ROTULO_DIA_LONGO, diaSemanaHojeSaoPaulo } from "@/lib/dias-semana";
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
  const [sessoesAtivas, recordes] = await Promise.all([
    getSessoesAtivasTreino(params.token, params.slug),
    getRecordesAluno(params.token, params.slug),
  ]);

  const hoje = diaSemanaHojeSaoPaulo();

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
        iniciar={iniciarSessaoTreino.bind(null, params.slug, params.token)}
        salvarProgresso={salvarProgressoTreino.bind(null, params.slug, params.token)}
        finalizar={finalizarSessaoTreino.bind(null, params.slug, params.token)}
      />
    </div>
  );
}
