/**
 * Dados de DEMONSTRAÇÃO da landing em tela dividida. Nada aqui é cliente,
 * métrica ou resultado real: são os mesmos nomes fictícios que a landing já
 * usava, e toda superfície que os exibe carrega o rótulo "dados de
 * demonstração". O estado de cada painel é calculado a partir destes arrays
 * (não é imagem nem div decorativa posando de sistema).
 */

export type LinhaLog = {
  hora: string;
  nome: string;
  plano: string;
  resultado: "Liberado" | "Alerta";
};

/** Log da catraca antes de qualquer evento da cena. */
export const LOG_INICIAL: LinhaLog[] = [
  { hora: "18:57", nome: "Rafael Alves", plano: "Trimestral", resultado: "Liberado" },
  { hora: "18:51", nome: "Beatriz Pereira", plano: "Mensal", resultado: "Liberado" },
  { hora: "18:44", nome: "Diego Nunes", plano: "Mensal", resultado: "Alerta" },
];

/** O aluno da foto do topo: o mesmo Rafael que acabou de passar pela
 *  recepção no log ao lado (primeira linha). */
export const ALUNO_TOPO = { primeiroNome: LOG_INICIAL[0].nome.split(" ")[0] };

/** A linha que chega pelo check-in do evento 1. */
export const LOG_CHECKIN: LinhaLog = {
  hora: "19:02",
  nome: "Marina Costa",
  plano: "Mensal",
  resultado: "Liberado",
};

export const ACESSOS_ANTES = 63;

export const ALUNA = {
  primeiroNome: "Marina",
  academia: "Academia Movimento",
  treino: "Treino B",
  foco: "Costas + bíceps",
  exercicios: 6,
  minutos: 45,
  mensalidade: "setembro",
  pagaEm: "24/09",
};

/** A ficha publicada (Treino B), com o que a aluna já fez antes da cena. */
export const FICHA = [
  { nome: "Puxada frontal", meta: "3 × 12 · 45 kg", feito: true },
  { nome: "Remada baixa", meta: "3 × 10 · 42 kg", feito: true },
  { nome: "Remada curvada", meta: "3 × 10 · 30 kg", feito: true },
  { nome: "Pulldown na corda", meta: "3 × 12 · 25 kg", feito: false },
  { nome: "Rosca direta", meta: "3 × 10 · 20 kg", feito: false },
  { nome: "Rosca martelo", meta: "3 × 12 · 12 kg", feito: false },
];
