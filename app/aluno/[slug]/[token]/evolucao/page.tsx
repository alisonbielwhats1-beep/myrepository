import EvolucaoCorpo from "@/components/aluno/EvolucaoCorpo";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getRecordesAluno } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * "Minha evolução" do aluno.
 *
 * O `progresso` (peso, gordura e medidas) já vinha na ficha — a RPC
 * `obter_ficha_aluno` devolve desde a migração 037 — e nunca era mostrado a
 * ele: trafegava a cada carregamento e era descartado. Esta rota é só leitura;
 * a única consulta extra são os recordes de carga, que vivem em outra RPC.
 */
export default async function EvolucaoPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  const ficha = await requireFichaAluno(params.slug, params.token);
  const recordes = await getRecordesAluno(params.token, params.slug);

  // O recorde é gravado por exercício da ficha; resolvemos o nome aqui, onde a
  // ficha está em mãos, para o componente receber algo já legível.
  const nomePorExercicio = new Map(
    ficha.treinos.flatMap((t) => t.exercicios ?? []).map((e) => [e.id, e.nome_exercicio])
  );
  const lista = Object.entries(recordes)
    .map(([id, kg]) => ({ nome: nomePorExercicio.get(id) ?? null, kg }))
    .filter((r): r is { nome: string; kg: number } => r.nome !== null)
    .sort((a, b) => b.kg - a.kg)
    .slice(0, 5);

  return (
    <EvolucaoCorpo
      base={`/aluno/${params.slug}/${params.token}`}
      progresso={ficha.progresso ?? []}
      recordes={lista}
    />
  );
}
