import { Barbell, CheckCircle, CurrencyCircleDollar, PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr";
import { ALUNA, FICHA } from "./demo";
import { Simbolo } from "./Marca";

/**
 * Cartões do ato "Conexão": o app aparece como gráfico animado sobre os
 * vídeos (a IA filma as pessoas; o produto entra nítido, no visual da
 * marca). Cada cartão responde aos estados que palco.ts publica no root:
 * data-ls-montagem (0..6), data-ls-series (0..3) e data-ev-<id>.
 * Tudo é demonstração, com o rótulo na própria peça.
 */

function Cabecalho({ origem, quando }: { origem: string; quando: string }) {
  return (
    <p className="ls-cartao__cab">
      <Simbolo tamanho={18} />
      <span>GestAcad · {origem}</span>
      <span className="ls-cartao__quando">{quando}</span>
    </p>
  );
}

/** Lado da academia: perto do notebook do dono. */
export function CartoesAcademia() {
  return (
    <div className="ls-cartoes ls-cartoes--a">
      {/* 1. Montando a ficha, exercício por exercício, e publicando. */}
      <div className="ls-cartao ls-cartao--claro" data-cartao="montagem">
        <Cabecalho origem="Painel" quando="demonstração" />
        <p className="ls-cartao__titulo">Montar ficha · Marina Costa</p>
        <ol className="ls-cartao__ficha">
          {FICHA.map((e, i) => (
            <li key={e.nome} data-montagem={i + 1}>
              <span className="ls-mono">{i + 1}</span>
              <b>{e.nome}</b>
              <span className="ls-mono">{e.meta.split(" · ")[0]}</span>
            </li>
          ))}
        </ol>
        {/* No celular a lista não cabe: fica só a contagem. */}
        <p className="ls-cartao__texto ls-cartao__contagem ls-mono">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <span key={n} data-montagem-rotulo={n}>
              {n} de {FICHA.length} exercícios na ficha
            </span>
          ))}
        </p>
        <span id="ls-painel-ficha" className="ls-cartao__botao">
          <span data-est="ficha-src:antes">
            <PaperPlaneTilt size={14} weight="fill" aria-hidden="true" /> Publicar ficha
          </span>
          <span data-est="ficha-src:depois">
            <CheckCircle size={14} weight="fill" aria-hidden="true" /> Publicada
          </span>
        </span>
      </div>

      {/* 2. O treino volta: adesão. */}
      <div id="ls-painel-adesao" className="ls-cartao ls-cartao--claro" data-cartao="adesao" data-dest="treino">
        <Cabecalho origem="Adesão aos treinos" quando="agora" />
        <p className="ls-cartao__titulo">
          <CheckCircle size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Marina finalizou o {ALUNA.treino}
        </p>
        <p className="ls-cartao__texto">
          {ALUNA.foco} · {FICHA.length} de {FICHA.length} exercícios · segue a ficha
        </p>
      </div>

      {/* 3. Registrando o pagamento. */}
      <div className="ls-cartao ls-cartao--claro" data-cartao="pagamento">
        <Cabecalho origem="Mensalidades" quando="setembro" />
        <p className="ls-cartao__titulo">Marina Costa · plano mensal</p>
        <span id="ls-painel-pagamento" className="ls-cartao__botao">
          <span data-est="mensalidade-src:antes">
            <CurrencyCircleDollar size={14} weight="fill" aria-hidden="true" /> Registrar pagamento
          </span>
          <span data-est="mensalidade-src:depois">
            <CheckCircle size={14} weight="fill" aria-hidden="true" /> Pago
          </span>
        </span>
      </div>
    </div>
  );
}

/** Lado do aluno: ao lado da aluna, como notificações do app. */
export function CartoesAluno() {
  const feitos = FICHA.filter((e) => e.feito).length;
  return (
    <div className="ls-cartoes ls-cartoes--b">
      {/* 1. A ficha chega. */}
      <div id="ls-cel-treino" className="ls-cartao ls-cartao--escuro" data-cartao="ficha" data-dest="ficha">
        <Cabecalho origem="app do aluno" quando="agora" />
        <p className="ls-cartao__titulo">
          <Barbell size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Nova ficha: {ALUNA.treino}
        </p>
        <p className="ls-cartao__texto">
          {ALUNA.foco} · {FICHA.length} exercícios · publicada pelo professor
        </p>
      </div>

      {/* 2. As séries: ela marca o que fez; depois finaliza. */}
      <div className="ls-cartao ls-cartao--escuro" data-cartao="series">
        <Cabecalho origem="Treinos" quando={ALUNA.treino} />
        <p className="ls-cartao__titulo">{ALUNA.foco}</p>
        <div className="ls-cartao__progresso" aria-hidden="true">
          <span />
        </div>
        <p className="ls-cartao__texto ls-mono">
          {[0, 1, 2, 3].map((n) => (
            <span key={n} data-series-rotulo={n}>
              {feitos + n} de {FICHA.length} concluídos
            </span>
          ))}
        </p>
        <span id="ls-cel-finalizar" className="ls-cartao__botao ls-cartao__botao--verde">
          <span data-est="treino-src:antes">Finalizar treino</span>
          <span data-est="treino-src:depois">
            <CheckCircle size={14} weight="fill" aria-hidden="true" /> Treino concluído
          </span>
        </span>
      </div>

      {/* 3. A mensalidade aparece paga. */}
      <div id="ls-cel-mensalidade" className="ls-cartao ls-cartao--escuro" data-cartao="mensalidade" data-dest="mensalidade">
        <Cabecalho origem="Mensalidades" quando="agora" />
        <p className="ls-cartao__titulo">
          <CheckCircle size={16} weight="fill" className="ls-cartao__ok" aria-hidden="true" /> Mensalidade de {ALUNA.mensalidade} paga
        </p>
        <p className="ls-cartao__texto">Registrada pela recepção em {ALUNA.pagaEm}</p>
      </div>
    </div>
  );
}
