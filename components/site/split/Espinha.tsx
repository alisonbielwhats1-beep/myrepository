import { List, SignIn } from "@phosphor-icons/react/dist/ssr";
import Marca, { Simbolo } from "./Marca";

const NAV = [
  { href: "#painel", rotulo: "O produto" },
  { href: "#funcionalidades", rotulo: "Recursos" },
  { href: "#duvidas", rotulo: "Dúvidas" },
  { href: "#planos", rotulo: "Planos" },
];

/**
 * A divisória é a navegação da página (gramática "split stage": sem barra no
 * topo). Fica fixa entre as duas colunas no desktop, carrega os rótulos dos
 * dois lados e as âncoras do percurso. Abaixo de 1024px vira um menu
 * compacto.
 *
 * "Entrar" é <a> comum, não <Link>: a landing carrega o engine e uma folha de
 * estilos própria, e uma navegação completa garante que nada disso siga para
 * o app.
 */
export default function Espinha() {
  return (
    <>
      <nav className="ls-espinha" aria-label="Navegação principal">
        <span className="ls-espinha__linha" aria-hidden="true" />
        <span className="ls-espinha__partida" aria-hidden="true" />

        <a
          href="#topo"
          className="ls-espinha__topo rounded-[9px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ls-sinal)]"
          aria-label="GestAcad, voltar ao início"
        >
          <Simbolo tamanho={40} />
        </a>
        <div className="ls-espinha__lados" aria-hidden="true">
          <span>A academia</span>
          <span>O aluno</span>
        </div>

        <div className="ls-espinha__nav">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="ls-chip" data-ls-nav>
              {n.rotulo}
            </a>
          ))}
        </div>
      </nav>

      {/* Acesso de quem já é cliente: fixo no canto, sempre à vista. */}
      <a href="/login" className="ls-entrar">
        <SignIn size={18} weight="bold" aria-hidden="true" />
        Entrar <small>no painel</small>
      </a>

      <div className="ls-menu">
        <a href="#topo" className="ls-menu__marca" aria-label="GestAcad, voltar ao início">
          <Marca tamanho={34} />
        </a>
        {/* <details> abre e fecha sem JavaScript e já é anunciado corretamente. */}
        <div className="ls-menu__direita">
        <a href="/login" className="ls-menu__entrar">
          Entrar
        </a>
        <details className="ls-menu__det relative">
          <summary className="ls-menu__botao list-none [&::-webkit-details-marker]:hidden">
            <List size={18} weight="bold" aria-hidden="true" /> Menu
          </summary>
          <nav className="ls-menu__lista" aria-label="Navegação principal (celular)">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.rotulo}
              </a>
            ))}
          </nav>
        </details>
        </div>
      </div>
    </>
  );
}
