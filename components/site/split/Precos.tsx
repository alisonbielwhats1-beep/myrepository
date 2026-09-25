"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { intervaloLabel } from "@/lib/faixas-comerciais";
import { paraCentavos, paraReais } from "@/lib/dinheiro";
import { formatBRL } from "@/lib/utils";

type Faixa = {
  nome: string;
  alunos_min: number;
  alunos_max: number;
  preco_mensal: number;
  destaque?: boolean;
};

/**
 * Seção "Planos": uma faixa por tamanho de academia, todas com o sistema
 * inteiro. Na tela dividida, a primeira faixa fica no lado claro, a última no
 * escuro e a do meio atravessa a divisória, como os sinais do ato Conexão.
 *
 * A chave mensal/anual é um <button role="switch"> comum; a troca do valor
 * é CSS (data-anual no root da seção). Os dois valores já saem no HTML do
 * servidor, então nada pisca na hidratação.
 */
export default function Precos({
  faixas,
  descontoAnual,
  cta,
}: {
  faixas: Faixa[];
  descontoAnual: number;
  cta: { href: string; externo: boolean; rotulo: string };
}) {
  const [anual, setAnual] = useState(false);
  const pct = Math.round(descontoAnual * 100);
  const linkProps = cta.externo ? { target: "_blank", rel: "noopener noreferrer" } : {};

  return (
    <div className="ls-precos__root" data-anual={anual ? "" : undefined}>
      <div className="ls-split ls-precos__topo">
        <div className="ls-col ls-col--a">
          <div className="ls-inner ls-inner--a" data-sc-in>
            <h2 id="ls-precos-titulo" className="ls-h2">
              O valor acompanha o tamanho da sua academia.
            </h2>
          </div>
        </div>
        <div className="ls-col ls-col--b">
          <div className="ls-inner ls-inner--b" data-sc-in>
            <p className="ls-lede">
              Todas as faixas têm o GestAcad inteiro: painel da academia e app do aluno. Muda só a quantidade de
              alunos ativos.
            </p>
            <div className="ls-precos__chave">
              <span aria-hidden="true" className={anual ? undefined : "is-on"}>
                Mensal
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={anual}
                aria-label={`Pagamento anual, ${pct}% de desconto`}
                className="ls-precos__switch"
                onClick={() => setAnual((v) => !v)}
              >
                <span aria-hidden="true" />
              </button>
              <span aria-hidden="true" className={anual ? "is-on" : undefined}>
                Anual <b>−{pct}%</b>
              </span>
            </div>
            <p className="ls-fine ls-precos__nota">
              No anual, os 12 meses são pagos de uma vez, com {pct}% de desconto.
            </p>
          </div>
        </div>
      </div>

      <ol className="ls-precos__grade" data-sc-stagger="90" data-sc-in>
        {faixas.map((f, i) => {
          const mensal = paraCentavos(f.preco_mensal);
          const mensalNoAnual = Math.round(mensal * (1 - descontoAnual));
          const lado = i === 0 ? "a" : i === faixas.length - 1 ? "b" : "meio";
          return (
            <li key={f.nome} className={`ls-preco ls-preco--${lado}${f.destaque ? " ls-preco--destaque" : ""}`}>
              <p className="ls-preco__nome ls-mono">{f.nome}</p>
              <p className="ls-preco__faixa">{intervaloLabel(f)} ativos</p>

              <div className="ls-preco__valor" aria-live="polite">
                <p className="ls-preco__mensal" aria-hidden={anual}>
                  <strong>{formatBRL(paraReais(mensal))}</strong>
                  <span>/mês</span>
                </p>
                <p className="ls-preco__anual" aria-hidden={!anual}>
                  <strong>{formatBRL(paraReais(mensalNoAnual))}</strong>
                  <span>/mês</span>
                </p>
              </div>
              <p className="ls-preco__cobranca ls-fine">
                <span className="ls-preco__mensal" aria-hidden={anual}>Cobrado todo mês</span>
                <span className="ls-preco__anual" aria-hidden={!anual}>
                  {formatBRL(paraReais(mensalNoAnual * 12))} cobrados uma vez por ano
                </span>
              </p>

              <ul className="ls-preco__lista">
                <li>
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  Painel da academia e app do aluno completos
                </li>
                <li>
                  <CheckCircle size={18} weight="fill" aria-hidden="true" />
                  Implantação acompanhada e suporte direto
                </li>
              </ul>

              <a href={cta.href} {...linkProps} className={f.destaque ? "ls-cta ls-preco__cta" : "ls-preco__cta ls-preco__cta--contorno"}>
                {cta.rotulo}
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
