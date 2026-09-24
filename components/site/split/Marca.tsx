/**
 * Marca da GestAcad para a landing.
 *
 * Símbolo: um "G" geométrico. O arco é a academia; a barra do G é verde e é
 * a mesma barra do sinal que atravessa a divisória na página. Construído em
 * uma grade de 40×40: arco de raio 10 com traço 5 (borda externa em 12,5),
 * aberto entre -40° e +10°, e a barra de 5 de altura que sai do centro e
 * passa 4 unidades para fora do arco: o sinal saindo do G.
 */

type Tom = "escuro" | "claro";

const CORES: Record<Tom, { fundo: string; traco: string; barra: string; texto: string; acento: string }> = {
  // sobre chão escuro
  escuro: { fundo: "#17191B", traco: "#F1EEE8", barra: "#A3E635", texto: "#F1EEE8", acento: "#A3E635" },
  // sobre chão claro
  claro: { fundo: "#0E0F10", traco: "#F1EEE8", barra: "#A3E635", texto: "#17150F", acento: "#3F6212" },
};

export function Simbolo({ tamanho = 36, tom = "escuro" }: { tamanho?: number; tom?: Tom }) {
  const c = CORES[tom];
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect width="40" height="40" rx="9" fill={c.fundo} />
      <path d="M27.66 13.57 A10 10 0 1 0 29.85 21.74" fill="none" stroke={c.traco} strokeWidth="5" />
      <rect x="18" y="17.5" width="18.5" height="5" rx="1" fill={c.barra} />
    </svg>
  );
}

export default function Marca({
  tom = "escuro",
  tamanho = 36,
  comNome = true,
}: {
  tom?: Tom;
  tamanho?: number;
  comNome?: boolean;
}) {
  const c = CORES[tom];
  return (
    <span className="inline-flex items-center gap-2.5">
      <Simbolo tamanho={tamanho} tom={tom} />
      {comNome && (
        <span className="ls-marca-texto" style={{ color: c.texto }}>
          Gest<span style={{ color: c.acento }}>Acad</span>
        </span>
      )}
    </span>
  );
}
