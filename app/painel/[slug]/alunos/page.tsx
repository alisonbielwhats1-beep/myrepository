import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoAlunos from "@/components/painel/GestaoAlunos";
import { requireSessao } from "@/lib/auth";
import {
  getAlunos,
  getCatalogoExercicios,
  getMensalidadesDetalhadas,
  getPlanos,
  getTodoHistoricoPlanos,
  getTodoProgresso,
  getTodosOsTreinos,
  type MensalidadeDetalhe,
} from "@/lib/data";
import { calcularStatusFinanceiro } from "@/lib/utils";
import type { StatusFinanceiro } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AlunosPage({
  params,
}: {
  params: { slug: string };
}) {
  const sessao = await requireSessao(params.slug);
  const [alunos, treinos, planos, catalogo, progresso, historico, mensalidades] =
    await Promise.all([
      getAlunos(sessao.academia.id),
      getTodosOsTreinos(sessao.academia.id),
      getPlanos(sessao.academia.id),
      getCatalogoExercicios(),
      getTodoProgresso(sessao.academia.id),
      getTodoHistoricoPlanos(sessao.academia.id),
      getMensalidadesDetalhadas(sessao.academia.id),
    ]);

  // Agrupa mensalidades por aluno; deriva statusFinanceiro e mapa detalhado da mesma query.
  const statusFinanceiroMap: Record<string, StatusFinanceiro> = {};
  const mensalidadesPorAluno: Record<string, MensalidadeDetalhe[]> = {};
  for (const m of mensalidades) {
    (mensalidadesPorAluno[m.aluno_id] ??= []).push(m);
  }
  for (const [alunoId, mens] of Object.entries(mensalidadesPorAluno)) {
    statusFinanceiroMap[alunoId] = calcularStatusFinanceiro(mens);
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs slug={params.slug} items={[{ label: "Alunos" }]} />
      <div>
        <h1 className="text-2xl font-bold text-white">Alunos</h1>
        <p className="text-sm text-slate-400">
          Cadastre alunos e monte a ficha individual de cada um. Treinos-modelo
          para compartilhar por QR ficam na aba{" "}
          <span className="text-slate-300">Treinos</span>.
        </p>
      </div>

      <GestaoAlunos
        slug={params.slug}
        alunosIniciais={alunos}
        treinosIniciais={treinos}
        planos={planos}
        catalogo={catalogo}
        progresso={progresso}
        historico={historico}
        statusFinanceiroMap={statusFinanceiroMap}
        mensalidadesPorAluno={mensalidadesPorAluno}
      />
    </div>
  );
}
