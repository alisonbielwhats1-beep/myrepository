import { AlertTriangle, CalendarClock, Flame, UserX } from "lucide-react";
import StatTile from "@/components/painel/StatTile";
import type { LinhaAdesaoTreino } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Seção "Adesão aos treinos" na página de Treinos do painel.
 *
 * Responde ao dono/professor a pergunta que a Retenção (acesso à catraca) não
 * responde: dos alunos com ficha montada, quem está de fato treinando e quem
 * parou. Lê `adesao_treinos_alunos` (migration 094). Se a migration ainda não
 * foi aplicada, `linhas` chega vazio e a seção inteira não é renderizada —
 * a página de Treinos continua igual.
 */
export default function AdesaoTreinos({
  linhas,
  dias = 30,
}: {
  linhas: LinhaAdesaoTreino[];
  dias?: number;
}) {
  const comFicha = linhas.filter((l) => l.tem_ficha);

  // Sem nenhum aluno com ficha (ou migration não aplicada): nada a mostrar.
  if (comFicha.length === 0) return null;

  const treinando = comFicha.filter((l) => l.sessoes_periodo > 0);
  const sumidos = comFicha.filter(
    (l) => l.sessoes_periodo === 0 && l.total_sessoes > 0
  );
  const nuncaTreinou = comFicha.filter((l) => l.total_sessoes === 0);

  // Lista de ação: quem precisa de atenção primeiro — parou de treinar
  // (mais antigo no topo) e depois quem tem ficha mas nunca começou.
  const emRisco = [
    ...sumidos.sort((a, b) => tempo(a.ultima_sessao) - tempo(b.ultima_sessao)),
    ...nuncaTreinou.sort((a, b) => a.nome.localeCompare(b.nome)),
  ];
  const LIMITE = 12;
  const visiveis = emRisco.slice(0, LIMITE);
  const restantes = emRisco.length - visiveis.length;

  const pctAdesao = Math.round((treinando.length / comFicha.length) * 100);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-white">
            <Flame className="h-5 w-5 text-volt-300" />
            Adesão aos treinos
          </h2>
          <p className="text-sm text-slate-400">
            Dos alunos com ficha, quem está treinando de verdade — nos últimos{" "}
            {dias} dias. (Diferente da Retenção, que mede acesso à academia.)
          </p>
        </div>
        <span className="chip border-ink-600 bg-ink-800 text-slate-300">
          {pctAdesao}% treinando
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={CalendarClock}
          label="Com ficha"
          value={String(comFicha.length)}
          hint="alunos com treino montado"
          accent="slate"
        />
        <StatTile
          icon={Flame}
          label="Treinando"
          value={String(treinando.length)}
          hint={`ativos nos últimos ${dias} dias`}
          accent="volt"
        />
        <StatTile
          icon={AlertTriangle}
          label="Pararam"
          value={String(sumidos.length)}
          hint="treinavam e sumiram"
          accent={sumidos.length > 0 ? "amber" : "slate"}
        />
        <StatTile
          icon={UserX}
          label="Nunca começaram"
          value={String(nuncaTreinou.length)}
          hint="ficha montada, 0 treinos"
          accent={nuncaTreinou.length > 0 ? "red" : "slate"}
        />
      </div>

      {visiveis.length > 0 ? (
        <div className="surface overflow-hidden rounded-2xl">
          <p className="label-muted border-b border-ink-700 px-4 py-3">
            Precisam de atenção
          </p>
          <ul className="divide-y divide-ink-700/70">
            {visiveis.map((l) => {
              const nunca = l.total_sessoes === 0;
              return (
                <li
                  key={l.aluno_id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {l.nome}
                    </p>
                    <p className="text-xs text-slate-500">
                      {nunca
                        ? "Nunca iniciou um treino"
                        : `Último treino ${rotuloDias(l.ultima_sessao)} · ${l.total_sessoes} no total`}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex-none rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      nunca
                        ? "bg-red-500/10 text-red-400"
                        : "bg-amber-500/10 text-amber-300"
                    )}
                  >
                    {nunca ? "não começou" : "parou"}
                  </span>
                </li>
              );
            })}
          </ul>
          {restantes > 0 && (
            <p className="border-t border-ink-700 px-4 py-2.5 text-xs text-slate-500">
              + {restantes} outro{restantes === 1 ? "" : "s"} aluno
              {restantes === 1 ? "" : "s"} precisando de atenção.
            </p>
          )}
        </div>
      ) : (
        <div className="surface rounded-2xl p-4 text-sm text-volt-300">
          🎉 Todo mundo com ficha treinou nos últimos {dias} dias. Excelente
          adesão!
        </div>
      )}
    </section>
  );
}

/** ms desde a data (para ordenar); datas nulas vão para o fim (mais antigo). */
function tempo(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

/** "hoje" / "ontem" / "há N dias" a partir de uma data ISO. */
function rotuloDias(iso: string | null): string {
  if (!iso) return "há muito tempo";
  const dias = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  );
  if (dias === 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${dias} dias`;
}
