import { AlertTriangle, CalendarCheck2, CheckCircle2, History } from "lucide-react";
import { frequenciaSemanaEMes, requireFichaAluno, ultimoAcessoEfetivo } from "@/lib/aluno-publico";
import { getFrequenciaAlunoPublico } from "@/lib/data";
import { cn, formatDataHora } from "@/lib/utils";

export default async function FrequenciaPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);
  const acessos = await getFrequenciaAlunoPublico(params.token, params.slug);

  const { semana, mes } = frequenciaSemanaEMes(acessos);
  const ultimoAcesso = ultimoAcessoEfetivo(acessos);
  const recentes = acessos.slice(0, 20);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua presença</p>
        <h1 className="text-2xl font-bold text-white">Frequência</h1>
      </header>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="surface rounded-2xl p-4">
          <CalendarCheck2 className="h-5 w-5 text-volt-300" />
          <div className="mt-3 stat-value text-2xl">{semana}</div>
          <div className="label-muted">acessos nos últimos 7 dias</div>
        </div>
        <div className="surface rounded-2xl p-4">
          <History className="h-5 w-5 text-cyanx-400" />
          <div className="mt-3 stat-value text-2xl">{mes}</div>
          <div className="label-muted">acessos nos últimos 30 dias</div>
        </div>
      </div>

      {/* Último acesso */}
      <div className="surface flex items-center justify-between rounded-2xl p-4">
        <span className="text-sm text-slate-300">Último acesso</span>
        <span className="text-sm font-medium text-white">
          {ultimoAcesso ? formatDataHora(ultimoAcesso) : "Nenhum acesso registrado"}
        </span>
      </div>

      {/* Histórico recente */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Últimos acessos
        </h2>

        {recentes.length === 0 ? (
          <div className="surface flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-700 text-slate-400">
              <History className="h-6 w-6" />
            </span>
            <p className="font-medium text-white">Nenhum acesso registrado ainda</p>
            <p className="max-w-xs text-sm text-slate-500">
              Assim que você entrar na academia, seu acesso aparece aqui.
            </p>
          </div>
        ) : (
          <div className="surface divide-y divide-ink-600/60 rounded-2xl">
            {recentes.map((a, i) => (
              <div
                key={`${a.data_hora_entrada}-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm text-slate-200">
                  {a.status_liberacao === "alerta" ? (
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-volt-300" />
                  )}
                  {formatDataHora(a.data_hora_entrada)}
                </div>
                <span
                  className={cn(
                    "chip",
                    a.status_liberacao === "alerta"
                      ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                      : "border-volt-500/30 bg-volt-500/15 text-volt-300"
                  )}
                >
                  {a.status_liberacao === "alerta" ? "Entrada com alerta" : "Liberado"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
