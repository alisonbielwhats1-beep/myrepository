import {
  LayoutGrid,
  Users,
  DoorOpen,
  Wallet,
  Dumbbell,
  ShieldCheck,
} from "lucide-react";

/**
 * Representação (não é captura real) do painel de gestão do GestAcad, no estilo
 * de uma janela de navegador. Usa dados fictícios explicitamente marcados como
 * demonstração. Reutilizado no Hero e na seção "Para o gestor e a equipe".
 */
const NAV = [
  { icon: LayoutGrid, label: "Visão geral", ativo: true },
  { icon: Users, label: "Alunos" },
  { icon: DoorOpen, label: "Recepção" },
  { icon: Wallet, label: "Financeiro" },
  { icon: Dumbbell, label: "Treinos" },
];

const STATS = [
  { label: "Alunos ativos", valor: "184", nota: "+12 no período" },
  { label: "Recebido", valor: "R$ 21,4 mil", nota: "visão do mês" },
  { label: "Acessos hoje", valor: "63", nota: "movimento atual" },
];

const FEED = [
  { ini: "MC", nome: "Marina Costa", texto: "Treino atualizado pela equipe", hora: "Agora" },
  { ini: "RA", nome: "Rafael Alves", texto: "Mensalidade confirmada", hora: "09:42" },
  { ini: "BP", nome: "Beatriz Pereira", texto: "Novo cadastro concluído", hora: "09:18" },
];

const ATENCAO = [
  { label: "Mensalidades próximas", valor: "4", cor: "bg-amber-400" },
  { label: "Alunos para acompanhar", valor: "7", cor: "bg-cyanx-400" },
  { label: "Acessos recentes", valor: "12", cor: "bg-volt-400" },
];

export default function DashboardMock() {
  return (
    <div className="surface-strong overflow-hidden rounded-2xl shadow-card">
      {/* Barra da janela */}
      <div className="flex items-center justify-between border-b border-ink-700/70 bg-ink-900/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
            <span className="h-2.5 w-2.5 rounded-full bg-ink-600" />
          </div>
          <span className="text-[11px] text-slate-400">
            GestAcad Gestão · dados de demonstração
          </span>
        </div>
        <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-volt-300" /> ambiente seguro
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-40 shrink-0 flex-col gap-1 border-r border-ink-700/60 p-3 sm:flex">
          <span className="mb-2 grid h-8 w-8 place-items-center rounded-lg bg-volt-300 text-sm font-black text-ink-950">
            G
          </span>
          {NAV.map((n) => (
            <span
              key={n.label}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${
                n.ativo
                  ? "bg-volt-500/15 text-volt-200"
                  : "text-slate-400"
              }`}
            >
              <n.icon className="h-3.5 w-3.5" /> {n.label}
            </span>
          ))}
        </aside>

        {/* Conteúdo */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-slate-500">Visão geral</p>
              <p className="text-base font-bold text-white sm:text-lg">
                Sua academia, agora
              </p>
            </div>
            <span className="grid h-8 w-8 place-items-center rounded-full border border-volt-500/40 bg-volt-500/10 text-[11px] font-bold text-volt-200">
              GA
            </span>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {STATS.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-ink-600/60 bg-ink-900/50 p-3"
              >
                <p className="text-[10px] text-slate-400">{s.label}</p>
                <p className="mt-1 text-sm font-bold text-white sm:text-base">
                  {s.valor}
                </p>
                <p className="text-[9px] text-slate-500">{s.nota}</p>
              </div>
            ))}
          </div>

          {/* Feed + atenção */}
          <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-ink-600/60 bg-ink-900/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Rotina de hoje</p>
                <span className="flex items-center gap-1 text-[10px] text-volt-300">
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-volt-400" />
                  em tempo real
                </span>
              </div>
              <ul className="mt-2.5 space-y-2">
                {FEED.map((f) => (
                  <li key={f.ini} className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-700 text-[9px] font-bold text-slate-300">
                      {f.ini}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-white">
                        {f.nome}
                      </span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {f.texto}
                      </span>
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {f.hora}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-ink-600/60 bg-ink-900/50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Precisa de atenção</p>
                <span className="text-[10px] text-slate-500">agora</span>
              </div>
              <ul className="mt-2.5 space-y-2.5">
                {ATENCAO.map((a) => (
                  <li key={a.label} className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.cor}`} />
                    <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">
                      {a.label}
                    </span>
                    <span className="shrink-0 text-xs font-bold text-white">
                      {a.valor}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
