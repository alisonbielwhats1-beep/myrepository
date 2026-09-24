import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Barbell,
  CheckCircle,
  CurrencyCircleDollar,
  PaperPlaneTilt,
} from "@phosphor-icons/react/dist/ssr";
import { ALUNA, FICHA } from "./demo";
import { Simbolo } from "./Marca";

/**
 * Ato "Conexão" em três passos, sem pin: cada linha é um momento real da
 * semana, com a peça de onde a ação sai, o que atravessa a divisória e a
 * peça onde ela chega. Rola como qualquer seção; quando a linha entra na
 * tela, palco.ts marca `data-on` e o CSS toca a travessia uma vez.
 * Tudo é demonstração, com o rótulo na própria peça.
 */

type Lado = "a" | "b";

function Cabecalho({ origem, quando }: { origem: string; quando: string }) {
  return (
    <p className="ls-cartao__cab">
      <Simbolo tamanho={18} />
      <span>GestAcad · {origem}</span>
      <span className="ls-cartao__quando">{quando}</span>
    </p>
  );
}

/** Botão da peça de origem: troca de "antes" para "depois" quando a linha entra. */
function Acao({ antes, depois, verde = false }: { antes: React.ReactNode; depois: React.ReactNode; verde?: boolean }) {
  return (
    <span className={`ls-cartao__botao ${verde ? "ls-cartao__botao--verde" : ""}`}>
      <span className="ls-passo__antes">{antes}</span>
      <span className="ls-passo__depois" aria-hidden="true">
        {depois}
      </span>
    </span>
  );
}

const feitos = FICHA.filter((e) => e.feito).length;

const PASSOS: {
  de: Lado;
  sinal: string;
  a: { titulo: string; cartao: React.ReactNode };
  b: { titulo: string; cartao: React.ReactNode };
}[] = [
  {
    de: "a",
    sinal: "Ficha",
    a: {
      titulo: "Você monta a ficha e publica.",
      cartao: (
        <div className="ls-cartao ls-cartao--claro">
          <Cabecalho origem="Painel" quando="demonstração" />
          <p className="ls-cartao__titulo">Ficha · Marina Costa</p>
          <ol className="ls-cartao__ficha">
            {FICHA.map((e, i) => (
              <li key={e.nome}>
                <span className="ls-mono">{i + 1}</span>
                <b>{e.nome}</b>
                <span className="ls-mono">{e.meta.split(" · ")[0]}</span>
              </li>
            ))}
          </ol>
          <Acao
            antes={<><PaperPlaneTilt size={14} weight="fill" aria-hidden="true" /> Publicar ficha</>}
            depois={<><CheckCircle size={14} weight="fill" aria-hidden="true" /> Publicada</>}
          />
        </div>
      ),
    },
    b: {
      titulo: "Ela recebe na hora, no celular.",
      cartao: (
        <div className="ls-cartao ls-cartao--escuro">
          <Cabecalho origem="app do aluno" quando="agora" />
          <p className="ls-cartao__titulo">
            <Barbell size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Nova ficha: {ALUNA.treino}
          </p>
          <p className="ls-cartao__texto">
            {ALUNA.foco} · {FICHA.length} exercícios · publicada pelo professor
          </p>
        </div>
      ),
    },
  },
  {
    de: "b",
    sinal: "Treino",
    a: {
      titulo: "Você vê quem está seguindo a ficha.",
      cartao: (
        <div className="ls-cartao ls-cartao--claro">
          <Cabecalho origem="Adesão aos treinos" quando="agora" />
          <p className="ls-cartao__titulo">
            <CheckCircle size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Marina finalizou o {ALUNA.treino}
          </p>
          <p className="ls-cartao__texto">
            {ALUNA.foco} · {FICHA.length} de {FICHA.length} exercícios · segue a ficha
          </p>
        </div>
      ),
    },
    b: {
      titulo: "Ela marca as séries e finaliza o treino.",
      cartao: (
        <div className="ls-cartao ls-cartao--escuro">
          <Cabecalho origem="Treinos" quando={ALUNA.treino} />
          <p className="ls-cartao__titulo">{ALUNA.foco}</p>
          <div className="ls-cartao__progresso" aria-hidden="true">
            <span style={{ ["--de" as string]: feitos / FICHA.length }} />
          </div>
          <p className="ls-cartao__texto ls-mono ls-troca">
            <span className="ls-passo__antes">
              {feitos} de {FICHA.length} concluídos
            </span>
            <span className="ls-passo__depois" aria-hidden="true">
              {FICHA.length} de {FICHA.length} concluídos
            </span>
          </p>
          <Acao
            verde
            antes="Finalizar treino"
            depois={<><CheckCircle size={14} weight="fill" aria-hidden="true" /> Treino concluído</>}
          />
        </div>
      ),
    },
  },
  {
    de: "a",
    sinal: "Pagamento",
    a: {
      titulo: "A recepção registra o pagamento.",
      cartao: (
        <div className="ls-cartao ls-cartao--claro">
          <Cabecalho origem="Mensalidades" quando={ALUNA.mensalidade} />
          <p className="ls-cartao__titulo">Marina Costa · plano mensal</p>
          <p className="ls-cartao__texto">Vence em {ALUNA.pagaEm}</p>
          <Acao
            antes={<><CurrencyCircleDollar size={14} weight="fill" aria-hidden="true" /> Registrar pagamento</>}
            depois={<><CheckCircle size={14} weight="fill" aria-hidden="true" /> Pago</>}
          />
        </div>
      ),
    },
    b: {
      titulo: "A mensalidade aparece paga para ela.",
      cartao: (
        <div className="ls-cartao ls-cartao--escuro">
          <Cabecalho origem="Mensalidades" quando="agora" />
          <p className="ls-cartao__titulo">
            <CheckCircle size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Mensalidade de {ALUNA.mensalidade} paga
          </p>
          <p className="ls-cartao__texto">Registrada pela recepção em {ALUNA.pagaEm}</p>
        </div>
      ),
    },
  },
];

export default function Conexao() {
  return (
    <ol className="ls-passos-con">
      {PASSOS.map((p, i) => {
        const para: Lado = p.de === "a" ? "b" : "a";
        const Seta = p.de === "a" ? ArrowRight : ArrowLeft;
        return (
          <li key={p.sinal} className={`ls-split ls-passo ls-passo--${p.de}${para}`}>
            {(["a", "b"] as const).map((lado) => (
              <div key={lado} className={`ls-col ls-col--${lado}`}>
                <div className={`ls-inner ls-inner--${lado} ls-passo__inner`}>
                  <p className="ls-passo__num ls-mono">
                    {lado === "a" ? "Na recepção" : "No celular da Marina"} · {i + 1}/{PASSOS.length}
                  </p>
                  <h3 className="ls-passo__titulo">{p[lado].titulo}</h3>
                  <div className={lado === p.de ? "ls-passo__origem" : "ls-passo__destino"}>{p[lado].cartao}</div>
                </div>
              </div>
            ))}
            <span className="ls-passo__sinal" aria-hidden="true">
              {p.de === "b" && <Seta size={12} weight="bold" className="ls-passo__seta-d" />}
              <ArrowDown size={12} weight="bold" className="ls-passo__seta-m" />
              {p.sinal}
              {p.de === "a" && <Seta size={12} weight="bold" className="ls-passo__seta-d" />}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
