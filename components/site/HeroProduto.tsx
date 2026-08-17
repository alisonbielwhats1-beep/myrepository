import { TrendingUp } from "lucide-react";
import DashboardMock from "@/components/site/DashboardMock";
import PhoneMock from "@/components/site/PhoneMock";

/**
 * Composição visual do produto para o Hero: o painel de gestão (DashboardMock)
 * com o app do aluno (PhoneMock) sobreposto e um selo "mesmo ecossistema".
 * Não são capturas reais — representação com dados fictícios de demonstração.
 */
export default function HeroProduto() {
  return (
    <div className="relative">
      <DashboardMock />

      {/* App do aluno sobreposto */}
      <div className="mt-5 flex justify-center lg:absolute lg:-bottom-16 lg:-right-6 lg:mt-0 lg:animate-float">
        <PhoneMock comAbas>
          <TelaAlunoHome />
        </PhoneMock>
      </div>

      {/* Selo — só no desktop */}
      <div className="pointer-events-none absolute -bottom-8 left-4 hidden xl:block">
        <div className="surface-strong flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 shadow-card">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-500/15 text-volt-300">
            <TrendingUp className="h-4 w-4" />
          </span>
          <span className="text-xs leading-tight text-slate-300">
            Gestão e aluno
            <span className="block font-semibold text-white">
              conectados no mesmo ecossistema
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Tela inicial do app do aluno (demonstração). */
function TelaAlunoHome() {
  return (
    <>
      <p className="text-[9px] text-slate-500">Academia Movimento</p>
      <p className="text-sm font-bold text-white">Olá, Marina.</p>

      {/* Treino de hoje */}
      <div className="mt-2.5 rounded-2xl border border-volt-500/40 bg-gradient-to-br from-volt-500/15 to-volt-500/5 p-3">
        <p className="text-[9px] text-slate-400">Treino de hoje</p>
        <p className="text-sm font-bold text-white">Costas + bíceps</p>
        <p className="text-[9px] text-slate-400">6 exercícios · cerca de 45 min</p>
        <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-volt-300">
          <span className="h-1.5 w-1.5 rounded-full bg-volt-400" /> Pronto para começar
        </p>
      </div>

      {/* Sequência / Plano */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-2">
          <p className="text-[8px] text-slate-500">Sequência</p>
          <p className="text-[11px] font-bold text-white">3 semanas</p>
        </div>
        <div className="rounded-xl border border-ink-600/60 bg-ink-900/60 p-2">
          <p className="text-[8px] text-slate-500">Plano</p>
          <p className="text-[11px] font-bold text-white">Em dia</p>
        </div>
      </div>

      {/* Última atividade */}
      <div className="mt-2 rounded-xl border border-ink-600/60 bg-ink-900/60 p-2.5">
        <p className="text-[8px] text-slate-500">Última atividade</p>
        <p className="text-[11px] font-bold text-white">Peito + tríceps</p>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full animate-progress-fill rounded-full bg-volt-400"
            style={{ ["--alvo" as string]: "66%" }}
          />
        </div>
        <p className="mt-1 text-[8px] text-slate-500">4 de 6 exercícios</p>
      </div>
    </>
  );
}
