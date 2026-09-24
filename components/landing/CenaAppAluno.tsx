import { Check, ChevronRight, Flame, TrendingUp } from "lucide-react";
import ScrollScene from "@/components/landing/ScrollScene";
import QrDecorativo from "@/components/landing/QrDecorativo";

/**
 * O app do aluno em rolagem lateral: o scroll vertical empurra um trilho de
 * telas para o lado. Lateral lê como "variedade", que é o que esta parte
 * mostra. Com "reduzir movimento", o trilho vira uma área de rolagem nativa.
 * Telas desenhadas em HTML com dados de demonstração.
 */
const RECURSOS = [
  "Consulta a ficha de treino publicada pelo professor",
  "Inicia, retoma e finaliza o treino registrando carga e repetições",
  "Recebe sugestão de carga a partir do esforço que registrou",
  "Acompanha mensalidades, vencimentos e pagamentos confirmados",
  "Vê a própria frequência e o histórico de acessos",
  "Apresenta o QR Code, que a recepção valida com segurança",
];

export default function CenaAppAluno() {
  return (
    <ScrollScene
      id="aplicativo"
      span={3.4}
      spanMobile={4.2}
      pan
      className="lp-app"
      label="Aplicativo do aluno"
    >
      <div className="lp-app__rail" data-rail>
        <div className="lp-app__intro">
          <h2 className="lp-display lp-h2">
            Uma experiência moderna <span className="text-volt-300">também para o aluno.</span>
          </h2>
          <p className="lp-lede">
            Cada aluno recebe um link pessoal da academia e acessa tudo pelo
            celular, sem instalar nada.
          </p>
        </div>

        <Tela legenda="Início" i={1}>
          <p className="text-[10px] text-slate-500">Academia Movimento</p>
          <p className="lp-display text-[15px] text-white">Olá, Marina</p>
          <div className="lp-scr__destaque">
            <p className="text-[10px] text-slate-400">Treino de hoje</p>
            <p className="text-sm font-semibold text-white">Costas + bíceps</p>
            <p className="text-[10px] text-slate-400">6 exercícios · cerca de 45 min</p>
            <span className="lp-scr__btn">Começar treino</span>
          </div>
          <div className="lp-scr__dupla">
            <div><small>Sequência</small><b><Flame className="h-3 w-3 text-volt-300" /> 3 semanas</b></div>
            <div><small>Plano</small><b>Em dia</b></div>
          </div>
        </Tela>

        <Tela legenda="Semana" i={2}>
          <p className="lp-display text-[15px] text-white">Sua semana</p>
          <ul className="lp-scr__semana">
            {[
              ["Seg", "Treino A", "feito"],
              ["Ter", "Treino B", "feito"],
              ["Qua", "Descanso", "folga"],
              ["Qui", "Treino A", "hoje"],
              ["Sex", "Treino B", ""],
              ["Sáb", "Treino C", ""],
            ].map(([d, t, s]) => (
              <li key={d} className={s ? `is-${s}` : undefined}>
                <span>{d}</span>
                <b>{t}</b>
                {s === "feito" && <Check className="h-3.5 w-3.5" />}
                {s === "hoje" && <em>hoje</em>}
              </li>
            ))}
          </ul>
        </Tela>

        <Tela legenda="Série a série" i={3}>
          <p className="text-[10px] text-slate-500">Exercício 2 de 6</p>
          <p className="lp-display text-[15px] text-white">Remada curvada</p>
          <div className="lp-scr__series">
            {[
              ["1", "30 kg", "10", true],
              ["2", "30 kg", "10", true],
              ["3", "30 kg", "—", false],
              ["4", "30 kg", "—", false],
            ].map(([n, c, r, ok]) => (
              <p key={n as string} className={ok ? "is-ok" : undefined}>
                <span>Série {n}</span>
                <span>{c}</span>
                <span>{r === "—" ? "" : `${r} rep`}</span>
                {ok ? <Check className="h-3.5 w-3.5" /> : <i />}
              </p>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">Como foi o esforço?</p>
          <div className="lp-scr__esforco">
            <span className="is-ativo">Leve</span>
            <span>Médio</span>
            <span>Pesado</span>
          </div>
        </Tela>

        <Tela legenda="Evolução" i={4}>
          <p className="lp-display text-[15px] text-white">Sua evolução</p>
          <div className="lp-scr__sugestao">
            <TrendingUp className="h-4 w-4 text-volt-300" />
            <p>
              <small>Remada curvada</small>
              Você marcou leve. Tente <b>32,5 kg</b> hoje.
            </p>
          </div>
          <p className="mt-3 text-[10px] text-slate-400">Treinos por semana</p>
          <div className="lp-scr__barras">
            {[2, 3, 3, 2, 4, 3, 4].map((v, i) => (
              <span key={i} style={{ height: `${v * 22}%` }} />
            ))}
          </div>
        </Tela>

        <Tela legenda="Acesso" i={5}>
          <p className="lp-display text-[15px] text-white">Seu acesso</p>
          <div className="lp-scr__qr">
            <QrDecorativo className="h-full w-full text-ink-950" />
          </div>
          <p className="lp-scr__linha">
            <span>Mensalidade de setembro</span>
            <em className="lp-tag lp-tag--ok">Paga</em>
          </p>
          <p className="lp-scr__linha">
            <span>Próximo vencimento</span>
            <b>05/10</b>
          </p>
        </Tela>

        <div className="lp-app__fim">
          <p className="lp-app__fim-titulo">Tudo o que o aluno faz pelo link:</p>
          <ul>
            {RECURSOS.map((r) => (
              <li key={r}>
                <ChevronRight className="h-4 w-4 shrink-0 text-volt-300" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ScrollScene>
  );
}

function Tela({
  legenda,
  i,
  children,
}: {
  legenda: string;
  i: number;
  children: React.ReactNode;
}) {
  return (
    <figure className="lp-app__item" style={{ "--i": i } as React.CSSProperties}>
      <div className="lp-phone" aria-hidden="true">
        <div className="lp-phone__bar">
          <span>9:41</span>
          <span className="lp-phone__notch" />
        </div>
        <div className="lp-phone__body">{children}</div>
      </div>
      <figcaption className="lp-app__legenda">{legenda}</figcaption>
    </figure>
  );
}
