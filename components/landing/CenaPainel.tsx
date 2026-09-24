import { AlertTriangle, DoorOpen, TrendingUp, Users, Wallet } from "lucide-react";
import ScrollScene from "@/components/landing/ScrollScene";

/**
 * Um dia na academia, guiado pelo scroll. O relógio avança das 06:00 ao fim
 * do dia e o painel reage a cada momento: a entrada na recepção, o alerta de
 * vencimento, o pico da noite e o fechamento do caixa.
 *
 * Estados discretos (`--step`, de 0 a 4) em vez de interpolação contínua: é o
 * sistema respondendo a eventos, não uma animação. Dados de demonstração.
 */
const MOMENTOS = [
  { hora: "06:00", texto: "A academia abre. O painel já mostra quem vence hoje." },
  { hora: "07:02", texto: "Marina apresenta o QR Code. A entrada fica registrada na hora." },
  { hora: "10:15", texto: "A mensalidade do Rafael vence hoje. O alerta aparece sozinho." },
  { hora: "19:00", texto: "Horário de pico. Você acompanha o movimento de onde estiver." },
  { hora: "23:59", texto: "Fim do dia. Recebido, em aberto e resultado já calculados." },
];

// Liga o elemento a partir do passo n (0 a 4).
const aPartirDe = (n: number) => ({ "--n": n }) as React.CSSProperties;

export default function CenaPainel() {
  return (
    <ScrollScene
      id="painel"
      span={3}
      spanMobile={3}
      steps={[0.16, 0.36, 0.56, 0.76]}
      className="lp-dia"
      label="Um dia no painel do GestAcad"
    >
      <div className="lp-dia__copy">
        <h2 className="lp-display lp-h2">
          Um dia inteiro da academia, <span className="text-volt-300">em uma única visão.</span>
        </h2>

        <div className="lp-dia__relogio" aria-hidden="true">
          {MOMENTOS.map((m, i) => (
            <span key={m.hora} className="lp-dia__hora" style={{ "--i": i } as React.CSSProperties}>
              {m.hora}
            </span>
          ))}
        </div>
        <ol className="lp-dia__momentos">
          {MOMENTOS.map((m, i) => (
            <li key={m.hora} className="lp-dia__momento" style={{ "--i": i } as React.CSSProperties}>
              <span className="lp-sr">{m.hora}. </span>
              {m.texto}
            </li>
          ))}
        </ol>
        <div className="lp-dia__trilho" aria-hidden="true">
          <span className="lp-dia__trilho-fill" />
        </div>
      </div>

      <div className="lp-dia__painel" aria-hidden="true">
        <div className="lp-dia__bar">
          <span className="lp-board__dots"><i /><i /><i /></span>
          Visão geral · dados de demonstração
        </div>

        <div className="lp-dia__stats">
          <Stat icone={<Users />} rotulo="Alunos ativos" valores={["184"]} />
          <Stat icone={<DoorOpen />} rotulo="Acessos hoje" valores={["0", "1", "1", "38", "63"]} />
          <Stat icone={<Wallet />} rotulo="Recebido hoje" valores={["R$ 0", "R$ 0", "R$ 119", "R$ 540", "R$ 1.020"]} />
        </div>

        <div className="lp-dia__grid">
          <div className="lp-dia__bloco">
            <p className="lp-dia__titulo">Recepção · entradas de hoje</p>
            <ul className="lp-dia__log">
              <li className="lp-on" style={aPartirDe(1)}>
                <span className="lp-av">MC</span> Marina Costa <em className="lp-tag lp-tag--ok">07:02</em>
              </li>
              <li className="lp-on" style={aPartirDe(3)}>
                <span className="lp-av">LA</span> Larissa Alves <em className="lp-tag lp-tag--ok">19:01</em>
              </li>
              <li className="lp-on" style={aPartirDe(3)}>
                <span className="lp-av">GS</span> Gustavo Souza <em className="lp-tag lp-tag--ok">19:04</em>
              </li>
              <li className="lp-dia__vazio lp-off" style={aPartirDe(1)}>
                Nenhuma entrada ainda hoje
              </li>
            </ul>
          </div>

          <div className="lp-dia__bloco">
            <p className="lp-dia__titulo">Precisam de atenção</p>
            <ul className="lp-dia__log">
              <li>
                <span className="lp-dot lp-dot--warn" /> 4 mensalidades vencem esta semana
              </li>
              <li className="lp-on lp-dia__alerta" style={aPartirDe(2)}>
                <AlertTriangle className="h-3.5 w-3.5 text-magenta-400" /> Rafael Alves · vence hoje
              </li>
              <li>
                <span className="lp-dot lp-dot--info" /> 7 alunos sem vir há 15 dias
              </li>
            </ul>
          </div>

          <div className="lp-dia__bloco lp-dia__bloco--largo">
            <p className="lp-dia__titulo">
              <TrendingUp className="h-3.5 w-3.5 text-volt-300" /> Resultado do mês
            </p>
            <div className="lp-dia__barras">
              {[38, 52, 47, 61, 58, 73, 69, 84].map((h, i) => (
                <span key={i} style={{ "--h": h, "--i": i } as React.CSSProperties} />
              ))}
            </div>
            <p className="lp-dia__fechamento lp-on" style={aPartirDe(4)}>
              Caixa do dia fechado · <strong>R$ 1.020 recebidos</strong>
            </p>
          </div>
        </div>
      </div>
    </ScrollScene>
  );
}

function Stat({
  icone,
  rotulo,
  valores,
}: {
  icone: React.ReactNode;
  rotulo: string;
  valores: string[];
}) {
  return (
    <div className="lp-dia__stat">
      <p className="lp-dia__stat-rot">
        <span className="lp-dia__stat-ic">{icone}</span>
        {rotulo}
      </p>
      <p className="lp-dia__stat-val">
        {valores.map((v, i) => (
          <span
            key={i}
            className="lp-dia__num"
            style={{ "--i": i, "--last": valores.length - 1 } as React.CSSProperties}
          >
            {v}
          </span>
        ))}
      </p>
    </div>
  );
}
