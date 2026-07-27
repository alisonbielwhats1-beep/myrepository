import Breadcrumbs from "@/components/painel/Breadcrumbs";
import GestaoAlunos from "@/components/painel/GestaoAlunos";
import { requireSessao } from "@/lib/auth";
import {
  getAlunosPaginado,
  getCatalogoExercicios,
  getHistoricoPlanosDosAlunos,
  getMensalidadesDetalhadasDosAlunos,
  getPlanos,
  getProgressoDosAlunos,
  getTreinosDosAlunos,
  type MensalidadeDetalhe,
} from "@/lib/data";
import { calcularStatusFinanceiro } from "@/lib/utils";
import type { StatusFinanceiro, StatusMatricula } from "@/lib/types";

export const dynamic = "force-dynamic";

const TAMANHO_PAGINA = 20;
const STATUS_VALIDOS: StatusMatricula[] = [
  "ativa",
  "inativa",
  "trancada",
  "pendente",
  "cancelada",
];

export default async function AlunosPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { pagina?: string; q?: string; status?: string; planoId?: string };
}) {
  const sessao = await requireSessao(params.slug);

  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const status = STATUS_VALIDOS.includes(searchParams.status as StatusMatricula)
    ? (searchParams.status as StatusMatricula)
    : undefined;

  // Fase 13: nada de carregar a base inteira de alunos — busca, filtro,
  // paginação e contagem total acontecem no banco (getAlunosPaginado).
  const [alunosPaginados, planos, catalogo] = await Promise.all([
    getAlunosPaginado(sessao.academia.id, {
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
      busca: searchParams.q,
      status,
      planoId: searchParams.planoId || undefined,
    }),
    getPlanos(sessao.academia.id),
    getCatalogoExercicios(),
  ]);

  // Treinos, progresso, histórico e mensalidades só dos alunos da página
  // atual — não da academia inteira (o painel à direita só mostra o aluno
  // selecionado, que está sempre entre esses).
  const alunoIds = alunosPaginados.alunos.map((a) => a.id);
  const [treinos, progresso, historico, mensalidades] = await Promise.all([
    getTreinosDosAlunos(sessao.academia.id, alunoIds),
    getProgressoDosAlunos(sessao.academia.id, alunoIds),
    getHistoricoPlanosDosAlunos(sessao.academia.id, alunoIds),
    getMensalidadesDetalhadasDosAlunos(sessao.academia.id, alunoIds),
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
        alunosIniciais={alunosPaginados.alunos}
        totalAlunos={alunosPaginados.total}
        pagina={pagina}
        tamanhoPagina={TAMANHO_PAGINA}
        buscaInicial={searchParams.q ?? ""}
        statusInicial={status ?? ""}
        planoIdInicial={searchParams.planoId ?? ""}
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
