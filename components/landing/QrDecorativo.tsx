/**
 * Desenho de QR Code puramente decorativo (não codifica nada): três marcas de
 * posição e um padrão fixo gerado por uma sequência determinística, para o
 * servidor e o navegador renderizarem exatamente o mesmo SVG.
 */
const N = 21;

function modulos() {
  const cel: [number, number][] = [];
  let s = 7;
  const marca = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      if (!marca(x, y) && (s >> 16) % 5 < 2) cel.push([x, y]);
    }
  }
  return cel;
}

const CELULAS = modulos();

function Marca({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x} y={y} width={7} height={7} rx={1.4} fill="currentColor" />
      <rect x={x + 1} y={y + 1} width={5} height={5} rx={0.9} fill="var(--qr-bg, #fff)" />
      <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.6} fill="currentColor" />
    </g>
  );
}

export default function QrDecorativo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox={`-1 -1 ${N + 2} ${N + 2}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x={-1} y={-1} width={N + 2} height={N + 2} rx={2} fill="var(--qr-bg, #fff)" />
      <Marca x={0} y={0} />
      <Marca x={N - 7} y={0} />
      <Marca x={0} y={N - 7} />
      {CELULAS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x + 0.08} y={y + 0.08} width={0.84} height={0.84} rx={0.2} fill="currentColor" />
      ))}
    </svg>
  );
}
