import { notFound } from "next/navigation";
import BotaoImprimir from "@/components/ui/BotaoImprimir";
import { requireSecao } from "@/lib/auth";
import { getAluno, getTreinosDosAlunos } from "@/lib/data";
import { calcularIdade, hojeSaoPaulo } from "@/lib/utils";
import { normalizarDias, resumoDias } from "@/lib/dias-semana";

export const dynamic = "force-dynamic";

/**
 * Página de impressão da ficha de treino do aluno — versão limpa para PAPEL.
 * Fica FORA do layout do painel de propósito: sem menu lateral, sem chrome,
 * fundo branco e texto preto, para sair bem em qualquer impressora comum (a
 * impressão é a nativa do navegador, sem integração de hardware).
 *
 * Autenticação e escopo por academia vêm de requireSecao (mesma regra das
 * telas do painel): quem não tem sessão/ação em "alunos" é redirecionado.
 */
export default async function ImprimirFichaPage({
  params,
}: {
  params: { slug: string; alunoId: string };
}) {
  const sessao = await requireSecao(params.slug, "alunos");

  const [aluno, treinos] = await Promise.all([
    getAluno(sessao.academia.id, params.alunoId),
    getTreinosDosAlunos(sessao.academia.id, [params.alunoId]),
  ]);

  if (!aluno) notFound();

  const idade = calcularIdade(aluno.data_nascimento);
  const dataImpressao = new Date(hojeSaoPaulo() + "T00:00:00").toLocaleDateString("pt-BR");
  const ordenados = [...treinos].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="min-h-screen bg-white text-black">
      {/* @page: margem de impressão; oculta o botão ao imprimir (.no-print já
          existe no CSS global, mas garantimos a margem aqui). */}
      <style>{`@media print { @page { margin: 1.4cm; } body { background: #fff; } }`}</style>

      <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
        {/* Barra de ação — some na impressão */}
        <div className="no-print mb-6 flex items-center justify-between gap-3">
          <a
            href={`/painel/${params.slug}/alunos`}
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-800"
          >
            ← Voltar ao painel
          </a>
          <BotaoImprimir />
        </div>

        {/* Cabeçalho da ficha */}
        <header className="border-b-2 border-black pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold leading-tight">Ficha de Treino</h1>
              <p className="mt-1 text-sm text-gray-600">{sessao.academia.nome_fantasia}</p>
            </div>
            <p className="text-right text-xs text-gray-500">
              Impresso em {dataImpressao}
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500">Aluno</dt>
              <dd className="font-semibold">{aluno.nome}</dd>
            </div>
            {aluno.matricula_codigo && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Matrícula</dt>
                <dd className="font-medium">{aluno.matricula_codigo}</dd>
              </div>
            )}
            {idade != null && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-gray-500">Idade</dt>
                <dd className="font-medium">{idade} anos</dd>
              </div>
            )}
            {aluno.objetivo && (
              <div className="col-span-2 sm:col-span-3">
                <dt className="text-xs uppercase tracking-wide text-gray-500">Objetivo</dt>
                <dd className="font-medium">{aluno.objetivo}</dd>
              </div>
            )}
          </dl>
        </header>

        {/* Treinos */}
        {ordenados.length === 0 ? (
          <p className="mt-8 text-sm text-gray-600">
            Este aluno ainda não tem nenhuma ficha de treino montada.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {ordenados.map((t) => {
              const exercicios = [...(t.exercicios ?? [])].sort((a, b) => a.ordem - b.ordem);
              return (
                <section key={t.id} className="break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-400 pb-1">
                    <h2 className="text-lg font-bold">{t.nome_treino}</h2>
                    <span className="text-xs text-gray-600">
                      {resumoDias(normalizarDias(t.dias_semana))}
                    </span>
                  </div>
                  {t.objetivo && (
                    <p className="mt-1 text-sm italic text-gray-600">{t.objetivo}</p>
                  )}

                  {exercicios.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">Sem exercícios cadastrados.</p>
                  ) : (
                    <table className="mt-2 w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-400 text-left text-xs uppercase tracking-wide text-gray-600">
                          <th className="w-8 py-1 pr-2 font-semibold">#</th>
                          <th className="py-1 pr-2 font-semibold">Exercício</th>
                          <th className="py-1 pr-2 font-semibold">Séries</th>
                          <th className="py-1 pr-2 font-semibold">Reps</th>
                          <th className="py-1 pr-2 font-semibold">Carga</th>
                          <th className="py-1 pr-2 font-semibold">Descanso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exercicios.map((ex, i) => (
                          <tr key={ex.id} className="border-b border-gray-200 align-top">
                            <td className="py-1.5 pr-2 tabular-nums text-gray-500">{i + 1}</td>
                            <td className="py-1.5 pr-2">
                              <span className="font-medium">{ex.nome_exercicio}</span>
                              {ex.observacoes && (
                                <span className="block text-xs text-gray-500">{ex.observacoes}</span>
                              )}
                            </td>
                            <td className="py-1.5 pr-2 tabular-nums">{ex.series}</td>
                            <td className="py-1.5 pr-2 tabular-nums">{ex.repeticoes}</td>
                            <td className="py-1.5 pr-2 tabular-nums">
                              {ex.carga_kg != null ? `${ex.carga_kg} kg` : "—"}
                            </td>
                            <td className="py-1.5 pr-2 tabular-nums">
                              {ex.descanso_segundos != null ? `${ex.descanso_segundos}s` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <footer className="mt-10 border-t border-gray-300 pt-3 text-center text-xs text-gray-400">
          {sessao.academia.nome_fantasia} · Ficha gerada pelo sistema de gestão
        </footer>
      </div>
    </div>
  );
}
