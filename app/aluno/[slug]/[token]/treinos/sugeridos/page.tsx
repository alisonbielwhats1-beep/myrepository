import Link from "next/link";
import { ArrowLeft, ChevronRight, Dumbbell, Info, Target } from "lucide-react";
import { requireFichaAluno } from "@/lib/aluno-publico";
import { getTreinosSugeridosAluno } from "@/lib/data";
import { separarNomeTreino } from "@/lib/treinos-sugeridos";

export const dynamic = "force-dynamic";

/**
 * Treinos sugeridos — a saída para o aluno que ainda não tem ficha.
 *
 * O caso que motivou a tela: aluno entra na academia num dia em que o instrutor
 * não consegue montar o treino na hora. Antes disso existir, ele abria a aba
 * Treinos e encontrava um beco sem saída. Agora encontra a biblioteca-padrão da
 * própria academia (migração 018), que sempre esteve no banco e só era visível
 * no painel.
 *
 * São SUGESTÕES, e a tela diz isso em todo lugar: nada é registrado, nenhum
 * recorde entra, e a ficha do instrutor continua sendo a fonte da verdade
 * quando chegar.
 */
export default async function TreinosSugeridosPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);
  const sugeridos = await getTreinosSugeridosAluno(params.token, params.slug);

  const base = `/aluno/${params.slug}/${params.token}`;

  // Agrupa por modalidade preservando a ordem que veio do banco (modalidade,
  // depois ordem) — Map mantém a ordem de inserção.
  const porModalidade = new Map<string, typeof sugeridos>();
  for (const t of sugeridos) {
    const chave = t.modalidade?.trim() || "Outros";
    porModalidade.set(chave, [...(porModalidade.get(chave) ?? []), t]);
  }

  return (
    <div className="space-y-5">
      <Link
        href={`${base}/treinos`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos meus treinos
      </Link>

      <header>
        <p className="text-sm text-slate-400">Para começar hoje</p>
        <h1 className="text-2xl font-bold text-white">Treinos sugeridos</h1>
      </header>

      <div className="surface flex items-start gap-3 rounded-2xl p-4">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-cyanx-400/10 text-cyanx-400">
          <Info className="h-4 w-4" />
        </span>
        <p className="text-sm leading-snug text-slate-400">
          São treinos prontos da sua academia, para você não ficar parado
          enquanto seu instrutor monta a sua ficha.{" "}
          <span className="text-slate-300">
            Nada aqui é registrado no seu histórico
          </span>{" "}
          — cargas, recordes e frequência continuam vindo da sua ficha.
        </p>
      </div>

      {sugeridos.length === 0 ? (
        <div className="surface rounded-2xl p-8 text-center text-slate-400">
          Sua academia ainda não publicou treinos sugeridos. Fale com a recepção
          para receber sua ficha.
        </div>
      ) : (
        Array.from(porModalidade.entries()).map(([modalidade, lista]) => (
          <section key={modalidade} className="space-y-2">
            <p className="label-muted">{modalidade}</p>
            {lista.map((t) => {
              const { titulo, grupos } = separarNomeTreino(t.nome_treino);
              const qtd = t.exercicios?.length ?? 0;
              return (
                <Link
                  key={t.id}
                  href={`${base}/treinos/sugeridos/${t.id}`}
                  className="surface flex items-center gap-3 rounded-xl p-3.5 transition active:scale-[0.99] hover:border-ink-500"
                >
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-volt-300/15 text-volt-300">
                    <Dumbbell className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {grupos ?? titulo}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      {grupos && <span className="truncate">{titulo}</span>}
                      <span>
                        {qtd} {qtd === 1 ? "exercício" : "exercícios"}
                      </span>
                      {t.nivel && <span className="text-slate-400">{t.nivel}</span>}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 flex-none text-slate-500" />
                </Link>
              );
            })}
          </section>
        ))
      )}

      {sugeridos.length > 0 && (
        <p className="flex items-start gap-1.5 px-1 text-xs text-slate-500">
          <Target className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Na dúvida sobre carga ou execução, chame um instrutor na academia
          antes de começar.
        </p>
      )}
    </div>
  );
}
