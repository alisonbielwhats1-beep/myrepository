// Helpers puros (sem I/O, sem React/Next) da tela "Minha evolução" do aluno.
//
// POR QUE ESTE MÓDULO EXISTE
//   A tabela `progresso_aluno` guarda peso, percentual de gordura e medidas
//   desde a migração 003, e a RPC `obter_ficha_aluno` já devolve tudo isso ao
//   navegador do aluno (campo `progresso` de FichaAlunoPublica). Até 10/09/2026
//   nada disso era exibido para ele: o dado trafegava a cada carregamento e era
//   descartado. Este módulo transforma a lista crua na leitura que o aluno quer
//   — "o que mudou em mim desde a primeira medição".
//
// SEM JULGAMENTO DE VALOR
//   Perder peso é bom para quem quer emagrecer e ruim para quem está ganhando
//   massa — e a ficha pública do aluno não carrega o objetivo dele. Por isso
//   nada aqui devolve "melhorou"/"piorou": devolvemos a variação com sinal e a
//   direção, e a tela mostra sem pintar de verde ou vermelho.
//
// Fica num módulo à parte, no mesmo padrão de lib/aluno-classificacao.ts, para
// ser compilável isoladamente pelos testes (`npm run test:evolucao`).

import type { ProgressoPublico } from "./types";

export type ChaveMedida =
  | "peso_kg"
  | "percentual_gordura"
  | "peito_cm"
  | "cintura_cm"
  | "quadril_cm"
  | "braco_cm"
  | "coxa_cm";

export const MEDIDAS: {
  chave: ChaveMedida;
  label: string;
  unidade: string;
  /** Casas decimais na exibição — peso e gordura têm meio-ponto útil. */
  casas: number;
}[] = [
  { chave: "peso_kg", label: "Peso", unidade: "kg", casas: 1 },
  { chave: "percentual_gordura", label: "Gordura", unidade: "%", casas: 1 },
  { chave: "peito_cm", label: "Peito", unidade: "cm", casas: 0 },
  { chave: "cintura_cm", label: "Cintura", unidade: "cm", casas: 0 },
  { chave: "quadril_cm", label: "Quadril", unidade: "cm", casas: 0 },
  { chave: "braco_cm", label: "Braço", unidade: "cm", casas: 0 },
  { chave: "coxa_cm", label: "Coxa", unidade: "cm", casas: 0 },
];

export type PontoMedida = { data: string; valor: number };

export type EvolucaoMedida = {
  chave: ChaveMedida;
  label: string;
  unidade: string;
  casas: number;
  primeiro: number;
  ultimo: number;
  /** `ultimo - primeiro`. Positivo = aumentou. Nunca "melhor" ou "pior". */
  delta: number;
  dataPrimeiro: string;
  dataUltimo: string;
  /** Quantas medições registraram este campo. */
  medicoes: number;
};

/** Ordena por data crescente sem depender da ordem que veio do banco. */
function porData(progresso: ProgressoPublico[]): ProgressoPublico[] {
  return [...progresso].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}

/**
 * Série temporal de UMA medida, já ordenada e sem os registros em que o campo
 * ficou vazio (a avaliação pode ter medido só peso, por exemplo).
 */
export function serieDaMedida(
  progresso: ProgressoPublico[],
  chave: ChaveMedida
): PontoMedida[] {
  const pontos: PontoMedida[] = [];
  for (const p of porData(progresso)) {
    const bruto = p[chave];
    if (typeof bruto !== "number" || !Number.isFinite(bruto)) continue;
    pontos.push({ data: p.data, valor: bruto });
  }
  return pontos;
}

/**
 * Primeira × última medição de cada campo medido pelo menos DUAS vezes.
 *
 * Com uma medição só não há evolução para mostrar — mostrar "0,0 kg de
 * variação" ali seria mentira estatística e frustração garantida. A tela trata
 * esse caso com um texto próprio, não com um número.
 *
 * Devolve na ordem de MEDIDAS (peso primeiro), que é a ordem em que o aluno
 * espera ler.
 */
export function evolucaoDasMedidas(
  progresso: ProgressoPublico[]
): EvolucaoMedida[] {
  const resultado: EvolucaoMedida[] = [];
  for (const m of MEDIDAS) {
    const serie = serieDaMedida(progresso, m.chave);
    if (serie.length < 2) continue;
    const primeiro = serie[0];
    const ultimo = serie[serie.length - 1];
    resultado.push({
      chave: m.chave,
      label: m.label,
      unidade: m.unidade,
      casas: m.casas,
      primeiro: primeiro.valor,
      ultimo: ultimo.valor,
      delta: Number((ultimo.valor - primeiro.valor).toFixed(2)),
      dataPrimeiro: primeiro.data,
      dataUltimo: ultimo.data,
      medicoes: serie.length,
    });
  }
  return resultado;
}

/**
 * Par de fotos para o antes/depois — a primeira e a última avaliação COM foto.
 * Devolve null quando há menos de duas: uma foto sozinha não é comparação.
 */
export function fotosDeComparacao(
  progresso: ProgressoPublico[]
): { antes: ProgressoPublico; depois: ProgressoPublico } | null {
  const comFoto = porData(progresso).filter(
    (p) => typeof p.foto_url === "string" && p.foto_url.trim() !== ""
  );
  if (comFoto.length < 2) return null;
  return { antes: comFoto[0], depois: comFoto[comFoto.length - 1] };
}

export type Sparkline = {
  /** `d` de um <path> com a linha. */
  linha: string;
  /** `d` de um <path> fechado para o preenchimento sob a linha. */
  area: string;
  /** Posição do último ponto, para destacá-lo. */
  fim: { x: number; y: number };
  minimo: number;
  maximo: number;
};

/**
 * Converte uma série em coordenadas de SVG.
 *
 * O eixo X é o ÍNDICE do ponto, não a data: avaliações costumam ser espaçadas
 * de forma irregular (uma em janeiro, outra em março, duas em abril) e espaçar
 * por tempo real espremeria os pontos próximos até virarem um borrão. Aqui o
 * aluno lê "a sequência das minhas medições", que é o que ele quer ver.
 *
 * Quando todos os valores são iguais, a linha vai ao meio da caixa em vez de
 * dividir por zero.
 *
 * O `padding` recua os dois eixos, e não só o vertical: o último ponto ganha um
 * marcador redondo na tela, e encostado na borda direita do viewBox ele sairia
 * cortado ao meio.
 */
export function sparkline(
  pontos: PontoMedida[],
  largura: number,
  altura: number,
  padding = 4
): Sparkline | null {
  if (pontos.length < 2 || largura <= 0 || altura <= 0) return null;

  const valores = pontos.map((p) => p.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo;

  const usavelY = Math.max(1, altura - padding * 2);
  const usavelX = Math.max(1, largura - padding * 2);
  const x = (i: number) => padding + (i / (pontos.length - 1)) * usavelX;
  const y = (v: number) =>
    amplitude === 0
      ? altura / 2
      : padding + (1 - (v - minimo) / amplitude) * usavelY;

  const coords = pontos.map((p, i) => ({ x: x(i), y: y(p.valor) }));
  const linha = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");
  // A área fecha no rodapé sobre o MESMO intervalo horizontal da linha, senão
  // ela vazaria para fora dela nas pontas.
  const primeiro = coords[0];
  const ultimo = coords[coords.length - 1];
  const area =
    `${linha} L${ultimo.x.toFixed(1)},${altura} ` +
    `L${primeiro.x.toFixed(1)},${altura} Z`;

  return { linha, area, fim: ultimo, minimo, maximo };
}

/** "12,5 kg" / "-3 cm" — com sinal explícito quando é variação. */
export function formatarMedida(
  valor: number,
  unidade: string,
  casas: number,
  comSinal = false
): string {
  const numero = Math.abs(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  const sinal = !comSinal ? "" : valor > 0 ? "+" : valor < 0 ? "−" : "";
  return `${sinal}${numero} ${unidade}`;
}
