import { CalendarX2, CheckCircle2, CircleSlash, Clock3, Receipt } from "lucide-react";
import { classificarMensalidade, requireFichaAluno } from "@/lib/aluno-publico";
import { getMensalidadesAlunoPublico } from "@/lib/data";
import { cn, formatBRL } from "@/lib/utils";
import type { ClassificacaoMensalidade } from "@/lib/aluno-publico";
import type { MensalidadeAlunoPublica } from "@/lib/types";

const ROTULO: Record<ClassificacaoMensalidade, string> = {
  vencida: "Vencida",
  pendente: "Pendente",
  paga: "Paga",
  cancelada: "Cancelada",
};

const BADGE: Record<ClassificacaoMensalidade, string> = {
  vencida: "bg-red-500/15 text-red-400 border-red-500/30",
  pendente: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  paga: "bg-volt-500/15 text-volt-300 border-volt-500/30",
  cancelada: "bg-ink-600 text-slate-400 border-ink-500",
};

const ICONE: Record<ClassificacaoMensalidade, typeof Clock3> = {
  vencida: CalendarX2,
  pendente: Clock3,
  paga: CheckCircle2,
  cancelada: CircleSlash,
};

function formatDataCurta(data: string): string {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function MensalidadesPage({
  params,
}: {
  params: { slug: string; token: string };
}) {
  await requireFichaAluno(params.slug, params.token);
  const mensalidades = await getMensalidadesAlunoPublico(params.token, params.slug);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua conta</p>
        <h1 className="text-2xl font-bold text-white">Mensalidades</h1>
      </header>

      {mensalidades.length === 0 ? (
        <div className="surface flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ink-700 text-slate-400">
            <Receipt className="h-6 w-6" />
          </span>
          <p className="font-medium text-white">Nenhuma mensalidade registrada</p>
          <p className="max-w-xs text-sm text-slate-500">
            Assim que sua academia gerar uma cobrança, ela aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mensalidades.map((m) => (
            <CardMensalidade key={m.id} mensalidade={m} />
          ))}
        </div>
      )}

      <p className="px-1 text-center text-xs text-slate-500">
        Para dúvidas sobre pagamento ou alteração de plano, fale com a
        recepção da academia.
      </p>
    </div>
  );
}

function CardMensalidade({ mensalidade }: { mensalidade: MensalidadeAlunoPublica }) {
  const classificacao = classificarMensalidade(mensalidade);
  const Icone = ICONE[classificacao];

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl border",
              BADGE[classificacao]
            )}
          >
            <Icone className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-white">
              {mensalidade.competencia
                ? new Date(`${mensalidade.competencia}T00:00:00`).toLocaleDateString(
                    "pt-BR",
                    { month: "long", year: "numeric" }
                  )
                : "Mensalidade"}
            </p>
            <p className="text-xs text-slate-500">
              Vencimento {formatDataCurta(mensalidade.data)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-white">{formatBRL(mensalidade.valor)}</p>
          <span className={cn("chip mt-1", BADGE[classificacao])}>
            {ROTULO[classificacao]}
          </span>
        </div>
      </div>

      {classificacao === "paga" && mensalidade.data_pagamento && (
        <p className="mt-3 border-t border-ink-600/60 pt-3 text-xs text-slate-400">
          Pago em {formatDataCurta(mensalidade.data_pagamento)}
          {mensalidade.forma_pagamento && ` · ${mensalidade.forma_pagamento}`}
        </p>
      )}
    </div>
  );
}
