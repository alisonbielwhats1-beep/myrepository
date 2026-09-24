import {
  BarChart3,
  DoorOpen,
  Dumbbell,
  Heart,
  LayoutGrid,
  Users,
  Wallet,
} from "lucide-react";
import ScrollScene from "@/components/landing/ScrollScene";

/**
 * O pico da página: a bagunça vira o sistema.
 *
 * Fase A (p 0 a ~0,38): seis objetos do dia a dia caem no palco, um por
 * problema, enquanto a frase de cada problema aparece ao lado.
 * Fase B (p ~0,40 a ~0,88): cada objeto viaja até o seu lugar no painel e
 * troca de face para o módulo que resolve aquele problema; a moldura do
 * painel surge em volta.
 *
 * Posições em % do quadro (unidades de container: cqw/cqh), separadas para
 * desktop e celular. Tudo é CSS sobre `--p`; ver `.lp-item` em landing.css.
 */

type Item = {
  chave: string;
  problema: string;
  tin: number;
  torg: number;
  /** desktop: caos (x, y, rotação, escala), ordem (x, y), tamanho (w, h) */
  d: [number, number, number, number, number, number, number, number];
  /** celular: idem */
  m: [number, number, number, number, number, number, number, number];
  caos: React.ReactNode;
  ordem: React.ReactNode;
};

const ITENS: Item[] = [
  {
    chave: "alunos",
    problema: "Cadastro espalhado em caderno e planilha.",
    tin: 0.02,
    torg: 0.4,
    d: [3, 12, -5, 0.84, 20, 11, 38, 42],
    m: [0, 16, -6, 0.8, 0, 10, 49, 29],
    caos: <FacePlanilha />,
    ordem: (
      <FaceModulo icone={<Users />} titulo="Alunos" nota="Ficha, plano e histórico juntos">
        <ul className="lp-mini-list">
          <li><span>Marina Costa</span><em className="lp-tag lp-tag--ok">Em dia</em></li>
          <li><span>Rafael Alves</span><em className="lp-tag lp-tag--warn">Vence hoje</em></li>
          <li><span>Beatriz Pereira</span><em className="lp-tag lp-tag--ok">Em dia</em></li>
          <li className="lp-hide-m"><span>João Lima</span><em className="lp-tag lp-tag--alert">Atrasado</em></li>
        </ul>
      </FaceModulo>
    ),
  },
  {
    chave: "mensalidades",
    problema: "Mensalidade atrasada que ninguém percebe.",
    tin: 0.075,
    torg: 0.45,
    d: [54, 2, 6, 0.72, 60, 11, 40, 20],
    m: [44, 4, 7, 0.78, 51, 10, 49, 29],
    caos: <FaceBilhete />,
    ordem: (
      <FaceModulo icone={<Wallet />} titulo="Mensalidades" nota="Vencimentos acompanhados">
        <p className="lp-mini-num">R$ 3.120 <small>em aberto</small></p>
      </FaceModulo>
    ),
  },
  {
    chave: "recepcao",
    problema: "Controle de entrada feito no papel.",
    tin: 0.13,
    torg: 0.5,
    d: [40, 44, -4, 0.9, 60, 33, 40, 20],
    m: [26, 40, -3, 0.84, 0, 41, 49, 29],
    caos: <FaceCaderno />,
    ordem: (
      <FaceModulo icone={<DoorOpen />} titulo="Recepção" nota="QR Code validado no painel">
        <p className="lp-mini-row"><span>Marina Costa</span><em className="lp-tag lp-tag--ok">Liberado 07:02</em></p>
      </FaceModulo>
    ),
  },
  {
    chave: "treinos",
    problema: "Ficha de treino perdida ou desatualizada.",
    tin: 0.185,
    torg: 0.55,
    d: [7, 52, 7, 0.82, 20, 55, 25, 45],
    m: [4, 60, 5, 0.8, 51, 41, 49, 29],
    caos: <FaceFicha />,
    ordem: (
      <FaceModulo icone={<Dumbbell />} titulo="Treinos" nota="Publicado direto no app do aluno">
        <ul className="lp-mini-list">
          <li><span>Treino B · Costas</span><em className="lp-tag lp-tag--ok">No app</em></li>
          <li><span>Remada curvada</span><em>4 × 10</em></li>
          <li><span>Puxada frontal</span><em>4 × 12</em></li>
          <li><span>Rosca direta</span><em>3 × 12</em></li>
        </ul>
      </FaceModulo>
    ),
  },
  {
    chave: "financeiro",
    problema: "Falta de visão do resultado do mês.",
    tin: 0.24,
    torg: 0.6,
    d: [71, 42, -8, 0.78, 47, 55, 26, 45],
    m: [50, 64, -8, 0.8, 0, 72, 49, 28],
    caos: <FaceGuardanapo />,
    ordem: (
      <FaceModulo icone={<BarChart3 />} titulo="Financeiro" nota="Resultado calculado sozinho">
        <p className="lp-mini-num">R$ 8.940 <small>no mês</small></p>
        <div className="lp-mini-bars" aria-hidden="true">
          {[42, 58, 50, 71, 64, 86].map((h, i) => (
            <span key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      </FaceModulo>
    ),
  },
  {
    chave: "retencao",
    problema: "Aluno que some sem ninguém notar.",
    tin: 0.295,
    torg: 0.65,
    d: [29, 5, 3, 0.8, 75, 55, 25, 45],
    m: [20, 22, 4, 0.78, 51, 72, 49, 28],
    caos: <FaceConversa />,
    ordem: (
      <FaceModulo icone={<Heart />} titulo="Retenção" nota="Quem está se afastando">
        <p className="lp-mini-num">7 <small>sem vir há 15 dias</small></p>
        <ul className="lp-mini-list">
          <li><span>Paulo Mendes</span><em>18 dias</em></li>
          <li><span>Ana Ribeiro</span><em>21 dias</em></li>
          <li className="lp-hide-m"><span>Lucas Prado</span><em>26 dias</em></li>
        </ul>
      </FaceModulo>
    ),
  },
];

const NAV = [
  { icon: LayoutGrid, label: "Visão geral" },
  { icon: Users, label: "Alunos" },
  { icon: DoorOpen, label: "Recepção" },
  { icon: Wallet, label: "Financeiro" },
  { icon: Dumbbell, label: "Treinos" },
  { icon: Heart, label: "Retenção" },
];

/** No celular só uma frase de problema aparece por vez: ela sai quando a próxima entra. */
function mbDe(i: number) {
  const proximo = ITENS[i + 1]?.tin;
  return proximo ? proximo + 0.03 : 0.37;
}

function vars(it: Item) {
  const [cx, cy, cr, cs, ox, oy, w, h] = it.d;
  const [mcx, mcy, mcr, mcs, mox, moy, mw, mh] = it.m;
  return {
    "--tin": it.tin,
    "--torg": it.torg,
    "--cx": cx, "--cy": cy, "--cr": cr, "--cs": cs,
    "--ox": ox, "--oy": oy, "--w": w, "--h": h,
    "--mcx": mcx, "--mcy": mcy, "--mcr": mcr, "--mcs": mcs,
    "--mox": mox, "--moy": moy, "--mw": mw, "--mh": mh,
  } as React.CSSProperties;
}

export default function CenaCaosOrdem() {
  return (
    <ScrollScene
      id="problemas"
      span={5.2}
      spanMobile={4.6}
      className="lp-caos"
      label="Da bagunça à organização"
      // Âncora do menu "Funcionalidades": cai no estado já organizado.
      fora={<span id="funcionalidades" className="lp-caos__ancora" aria-hidden="true" />}
    >
      <div className="lp-caos__col">
        {/* Fase A */}
        <div className="lp-cue lp-caos__a" style={{ "--a": -1, "--b": 0.4 } as React.CSSProperties}>
          <h2 className="lp-display lp-h2">
            Sem sistema, a rotina da academia vira isto.
          </h2>
        </div>
        <ul className="lp-caos__problemas">
          {ITENS.map((it, i) => (
            <li
              key={it.chave}
              className="lp-cue lp-caos__problema"
              style={
                {
                  "--a": it.tin,
                  "--b": 0.4,
                  "--mb": mbDe(i),
                } as React.CSSProperties
              }
            >
              <span className="lp-caos__marca" aria-hidden="true" />
              {it.problema}
            </li>
          ))}
        </ul>

        {/* Fase B */}
        <div className="lp-cue lp-caos__b" style={{ "--a": 0.4, "--d": 0.1 } as React.CSSProperties}>
          <h2 className="lp-display lp-h2">
            O GestAcad põe cada coisa <span className="text-volt-300">no seu lugar.</span>
          </h2>
          <p className="lp-lede">
            Cada problema vira um módulo do painel. Os mesmos dados, atualizados,
            para toda a equipe, sem sistema paralelo.
          </p>
        </div>
      </div>

      <div className="lp-board">
        <div className="lp-board__frame" aria-hidden="true">
          <div className="lp-board__bar">
            <span className="lp-board__dots"><i /><i /><i /></span>
            GestAcad Gestão · dados de demonstração
          </div>
          <ul className="lp-board__nav">
            {NAV.map(({ icon: Icon, label }, i) => (
              <li key={label} className={i === 0 ? "is-ativo" : undefined}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </li>
            ))}
          </ul>
        </div>

        {ITENS.map((it) => (
          <div key={it.chave} className="lp-item" style={vars(it)} aria-hidden="true">
            <div className="lp-face lp-face--caos">{it.caos}</div>
            <div className="lp-face lp-face--ordem">{it.ordem}</div>
          </div>
        ))}
      </div>
    </ScrollScene>
  );
}

function FaceModulo({
  icone,
  titulo,
  nota,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  nota: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="lp-mod">
      <p className="lp-mod__head">
        <span className="lp-mod__icon">{icone}</span>
        {titulo}
      </p>
      <p className="lp-mod__nota">{nota}</p>
      {children && <div className="lp-mod__body">{children}</div>}
    </div>
  );
}

/* ----- As faces da bagunça: objetos do dia a dia, desenhados em HTML ----- */

function FacePlanilha() {
  return (
    <div className="lp-obj lp-obj--planilha">
      <p className="lp-obj__file">alunos_FINAL_v3 (2).xlsx</p>
      <div className="lp-obj__grid">
        {["Nome", "Plano", "Pagou?", "Marina", "mensal", "sim", "Rafael", "tri", "???", "Bia", "mensal", "ver", "João", "", "não"].map(
          (c, i) => (
            <span key={i} className={c === "???" || c === "não" ? "is-alerta" : undefined}>
              {c}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function FaceBilhete() {
  return (
    <div className="lp-obj lp-obj--bilhete">
      <p>Rafael pagou?? conferir com a Ju antes de liberar</p>
    </div>
  );
}

function FaceCaderno() {
  return (
    <div className="lp-obj lp-obj--caderno">
      <p>Entrada seg. 06:00</p>
      <p>Marina 6h02 · Paulo 6h10</p>
      <p className="is-riscado">Lucas ?? · Ana</p>
    </div>
  );
}

function FaceFicha() {
  return (
    <div className="lp-obj lp-obj--ficha">
      <p className="lp-obj__titulo">TREINO A</p>
      <p className="is-riscado">Supino 3×10</p>
      <p>Remada 3×12</p>
      <p className="is-riscado">Leg 45°</p>
      <p className="lp-obj__nota">(de março)</p>
    </div>
  );
}

function FaceGuardanapo() {
  return (
    <div className="lp-obj lp-obj--guardanapo">
      <p>entrou 21 mil?</p>
      <p>− aluguel</p>
      <p>− luz ???</p>
      <p className="is-alerta">sobrou = ?</p>
    </div>
  );
}

function FaceConversa() {
  return (
    <div className="lp-obj lp-obj--conversa">
      <p className="lp-obj__balao">Oi! Faz 3 semanas que não apareço, ainda tô matriculado?</p>
      <p className="lp-obj__hora">visto há 21 dias</p>
    </div>
  );
}
