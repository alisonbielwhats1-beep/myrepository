/**
 * Moldura de celular realista (proporção 19,5:9), desenhada em CSS: borda de
 * titânio com botões laterais, tela com cantos concêntricos, ilha dinâmica,
 * barra de status, reflexo do vidro e indicador de início. Não é captura
 * real: o conteúdo da tela vem em `children`, e a barra de abas do app do
 * aluno fica fixa no rodapé da tela.
 */
import { Barbell, SquaresFour, User, Wallet } from "@phosphor-icons/react/dist/ssr";

function Sinal() {
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4.4} y={8 - i * 2.5} width="3" height={3 + i * 2.5} rx="0.8" fill="currentColor" />
      ))}
    </svg>
  );
}
function Wifi() {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M1.2 4.2a9 9 0 0 1 12.6 0" />
      <path d="M3.6 6.6a5.6 5.6 0 0 1 7.8 0" />
      <circle cx="7.5" cy="9.2" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function Bateria() {
  return (
    <svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true">
      <rect x="0.6" y="0.6" width="21" height="10.8" rx="3.2" fill="none" stroke="currentColor" strokeOpacity="0.45" />
      <rect x="2.2" y="2.2" width="14.5" height="7.6" rx="1.8" fill="currentColor" />
      <path d="M23 4v4c.8-.3 1.3-1.1 1.3-2S23.8 4.3 23 4Z" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

const ABAS = [
  { icon: SquaresFour, id: "inicio" },
  { icon: Barbell, id: "treinos" },
  { icon: Wallet, id: "mensalidades" },
  { icon: User, id: "perfil" },
];

export default function Celular({
  children,
  largura = 272,
  hora = "19:02",
  comAbas = true,
  className = "",
}: {
  children: React.ReactNode;
  largura?: number;
  hora?: string;
  comAbas?: boolean;
  className?: string;
}) {
  const tela = (
    <div className="ls-cel__tela">
      <div className="ls-cel__status" aria-hidden="true">
        <span className="ls-cel__hora">{hora}</span>
        <span className="ls-cel__ilha" />
        <span className="ls-cel__icones">
          <Sinal />
          <Wifi />
          <Bateria />
        </span>
      </div>
      <div className="ls-cel__conteudo">{children}</div>
      {comAbas && (
        <div className="ls-cel__abas" aria-hidden="true">
          {ABAS.map(({ icon: Icon, id }, i) => (
            <Icon key={id} size={20} weight={i === 0 ? "fill" : "regular"} className={i === 0 ? "text-volt-300" : "text-slate-500"} />
          ))}
        </div>
      )}
      <span className="ls-cel__indicador" aria-hidden="true" />
      <span className="ls-cel__reflexo" aria-hidden="true" />
    </div>
  );
  return (
    <div className={`ls-cel ${className}`} style={{ ["--w" as string]: `${largura}px` }}>
      <span className="ls-cel__botao ls-cel__botao--acao" aria-hidden="true" />
      <span className="ls-cel__botao ls-cel__botao--vol1" aria-hidden="true" />
      <span className="ls-cel__botao ls-cel__botao--vol2" aria-hidden="true" />
      <span className="ls-cel__botao ls-cel__botao--power" aria-hidden="true" />
      {tela}
    </div>
  );
}
