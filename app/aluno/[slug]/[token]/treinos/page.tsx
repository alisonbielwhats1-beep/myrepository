import TreinoViewer from "@/components/aluno/TreinoViewer";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getRecordesAluno, getSessoesAtivasTreino } from "@/lib/data";
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

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Seus treinos</p>
        <h1 className="text-2xl font-bold text-white">Ficha de treino</h1>
      </header>

      <TreinoViewer
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
