import {
  Barbell,
  CurrencyCircleDollar,
  DoorOpen,
  LockSimple,
  SquaresFour,
  Users,
} from "@phosphor-icons/react/dist/ssr";
import Celular from "./Celular";
import { ACESSOS_ANTES, ALUNA, ALUNO_TOPO, FICHA, LOG_CHECKIN, LOG_INICIAL, type LinhaLog } from "./demo";

/**
 * Superfícies do produto usadas na landing em tela dividida. São markup real
 * com dados de demonstração (rotulados), no mesmo idioma do painel e do app
 * do aluno. Os estados "antes/depois" de cada evento são trocados pelo
 * atributo data-est, controlado por palco.ts a partir do scroll.
 */

/* ------------------------------------------------------------ utilidades */

function Iniciais({ nome }: { nome: string }) {
  const ini = nome
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-700 text-[10.5px] font-semibold text-slate-300">
      {ini}
    </span>
  );
}

function Situacao({ resultado }: { resultado: LinhaLog["resultado"] }) {
  const alerta = resultado === "Alerta";
  return (
    <span className={`ls-situacao ${alerta ? "ls-situacao--alerta" : ""}`}>
      <span aria-hidden="true" />
      {resultado}
    </span>
  );
}

/** Linha da tabela de check-in: hora, aluno, plano e situação. */
function LinhaCheckin({ linha, id }: { linha: LinhaLog; id?: string }) {
  const alerta = linha.resultado === "Alerta";
  return (
    <div id={id} className="ls-tabela__linha" role="row">
      <span role="cell" className="ls-mono text-[11.5px] text-slate-500">
        {linha.hora}
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-2.5">
        <Iniciais nome={linha.nome} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium text-white">{linha.nome}</span>
          <span className="block truncate text-[11px] text-slate-500">mensalidade {alerta ? "vencida" : "em dia"}</span>
        </span>
      </span>
      <span role="cell" className="ls-tabela__plano truncate text-[12px] text-slate-400">
        {linha.plano}
      </span>
      <span role="cell" className="text-right">
        <Situacao resultado={linha.resultado} />
      </span>
    </div>
  );
}

const MENU = [
  { icon: SquaresFour, rotulo: "Visão geral" },
  { icon: Users, rotulo: "Alunos" },
  { icon: DoorOpen, rotulo: "Recepção", ativo: true },
  { icon: CurrencyCircleDollar, rotulo: "Financeiro" },
  { icon: Barbell, rotulo: "Treinos" },
];

/**
 * Janela do painel da academia no navegador: barra com o endereço, menu
 * lateral do sistema e a área da tela. O tema é o claro do app, porque vive
 * no lado claro da página.
 */
function JanelaPainel({
  caminho,
  titulo,
  children,
  className = "",
  comMenu = true,
}: {
  caminho: string;
  titulo: string;
  children: React.ReactNode;
  className?: string;
  comMenu?: boolean;
}) {
  return (
    <div className={`ls-janela ls-claro ${className}`}>
      <div className="ls-janela__barra">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ec6a5e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#f4bf4f]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#61c554]" />
        </span>
        <span className="ls-janela__url">
          <LockSimple size={11} weight="bold" aria-hidden="true" />
          <span className="truncate">app.gestacad.com.br{caminho}</span>
        </span>
        <span className="ls-janela__demo">dados de demonstração</span>
      </div>
      <div className="ls-janela__corpo">
        {comMenu && (
          <nav className="ls-janela__menu" aria-label="Menu do painel (demonstração)">
            {MENU.map(({ icon: Icon, rotulo, ativo }) => (
              <span key={rotulo} className={`ls-janela__item ${ativo ? "is-ativo" : ""}`} title={rotulo}>
                <Icon size={18} weight={ativo ? "fill" : "regular"} aria-hidden="true" />
                <span className="sr-only">{rotulo}</span>
              </span>
            ))}
          </nav>
        )}
        <div className="ls-janela__area">
          <p className="ls-janela__titulo">{titulo}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- hero */

export function HeroRecepcao() {
  return (
    <JanelaPainel caminho="/recepcao" titulo="Recepção" comMenu={false}>
      <div className="ls-tabela" role="table" aria-label="Últimos acessos (demonstração)">
        {LOG_INICIAL.slice(0, 2).map((l) => (
          <LinhaCheckin key={l.nome} linha={l} />
        ))}
      </div>
    </JanelaPainel>
  );
}

export function HeroCelular() {
  return (
    <Celular largura={262}>
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-medium text-volt-300">{ALUNA.academia}</p>
          <p className="text-[19px] font-extrabold tracking-[-0.02em] text-white">Bom treino, {ALUNO_TOPO.primeiroNome}.</p>
        </div>
        <div className="rounded-[18px] border border-volt-400/45 bg-gradient-to-b from-volt-300/[.16] to-volt-300/[.04] p-3.5">
          <p className="text-[10px] font-bold tracking-[.09em] text-volt-300">TREINO DE HOJE</p>
          <p className="mt-1 text-[17px] font-extrabold text-white">{ALUNA.foco}</p>
          <p className="text-[12px] text-slate-400">
            {ALUNA.exercicios} exercícios · cerca de {ALUNA.minutos} min
          </p>
          <span className="mt-3 block rounded-xl bg-volt-300 py-2.5 text-center text-[13px] font-bold text-ink-950">
            Retomar de onde parei
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-ink-600/60 bg-ink-800/80 p-3">
            <p className="text-[10px] tracking-[.07em] text-slate-500">SEQUÊNCIA</p>
            <p className="text-[18px] font-extrabold text-white">3 semanas</p>
          </div>
          <div className="rounded-2xl border border-ink-600/60 bg-ink-800/80 p-3">
            <p className="text-[10px] tracking-[.07em] text-slate-500">PLANO</p>
            <p className="text-[18px] font-extrabold text-white">Em dia</p>
          </div>
        </div>
      </div>
    </Celular>
  );
}

/* ------------------------------------------------------ fechamento */

export function CelularFechamento() {
  return (
    <Celular largura={250}>
      <div className="space-y-2.5">
        <div>
          <p className="text-[11px] font-medium text-volt-300">{ALUNA.academia}</p>
          <p className="text-[18px] font-extrabold tracking-[-0.02em] text-white">Bom treino, {ALUNA.primeiroNome}.</p>
        </div>
        {[
          ["Treino de hoje", ALUNA.foco],
          ["Mensalidade", `Paga em ${ALUNA.pagaEm}`],
          ["Acesso", "QR na recepção"],
        ].map(([r, v]) => (
          <div key={r} className="rounded-2xl border border-ink-600/60 bg-ink-800/80 px-3 py-2.5">
            <p className="text-[10px] tracking-[.07em] text-slate-500">{r.toUpperCase()}</p>
            <p className="text-[13.5px] font-semibold text-white">{v}</p>
          </div>
        ))}
      </div>
    </Celular>
  );
}
