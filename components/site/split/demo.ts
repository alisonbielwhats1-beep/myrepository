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

/** Janela (progresso do ato) em que o dono monta a ficha no painel. */
export const JANELA_MONTAGEM: [number, number] = [0.04, 0.2];

/** Janela (progresso do ato) em que ela marca os três exercícios restantes. */
export const JANELA_SERIES: [number, number] = [0.4, 0.56];

/**
 * Os três eventos que atravessam a divisória no ato "Conexão". `de` e
 * `para` são os ids dos elementos de origem e destino; `janela` é a fatia do
 * progresso do ato (0..1) em que o sinal viaja.
 */
export type EventoConexao = {
  id: string;
  sentido: "aluno-academia" | "academia-aluno";
  rotulo: string;
  janela: [number, number];
  de: string;
  para: string;
};

export const EVENTOS: EventoConexao[] = [
  { id: "ficha", sentido: "academia-aluno", rotulo: "Ficha", janela: [0.24, 0.36], de: "ls-painel-ficha", para: "ls-cel-treino" },
  { id: "treino", sentido: "aluno-academia", rotulo: "Treino", janela: [0.6, 0.72], de: "ls-cel-finalizar", para: "ls-painel-adesao" },
  { id: "mensalidade", sentido: "academia-aluno", rotulo: "Pagamento", janela: [0.8, 0.92], de: "ls-painel-pagamento", para: "ls-cel-mensalidade" },
];

/** Legendas do ato, na ordem em que aparecem. */
export const LEGENDAS: { inicio: number; texto: string }[] = [
  { inicio: JANELA_MONTAGEM[0], texto: "Na recepção, o dono monta a ficha da Marina no painel." },
  { inicio: EVENTOS[0].janela[0], texto: "Ele publica. A ficha chega na hora no celular dela." },
  { inicio: JANELA_SERIES[0], texto: "Entre uma série e outra, ela marca o que fez, com a carga que usou." },
  { inicio: EVENTOS[1].janela[0], texto: "Ela finaliza o treino. O dono vê quem está seguindo a ficha." },
  { inicio: EVENTOS[2].janela[0], texto: "A recepção registra o pagamento. A mensalidade aparece paga para ela." },
];
