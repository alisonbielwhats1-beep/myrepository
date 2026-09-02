/**
 * Guia rápido de exercício — músculo trabalhado + uma dica curta de execução,
 * resolvidos pelo NOME do exercício. Mesmo padrão de `img_exercicio_padrao` /
 * `video_exercicio_padrao` (nome → recurso), mas 100% no frontend: é conteúdo
 * de apoio, não dado do aluno, então não precisa de tabela nem migration.
 *
 * Objetivo: o iniciante abre o treino e entende "o que é isso e como faço",
 * sem depender só do vídeo. Nome desconhecido → devolve null e o card
 * simplesmente não mostra o guia (degradação graciosa).
 *
 * Cobertura em duas camadas:
 *   1. ESPECIFICOS — dica sob medida para os exercícios da biblioteca padrão.
 *   2. POR_PALAVRA — fallback por palavra-chave, para pelo menos identificar o
 *      grupo muscular de variações não mapeadas ("Supino Sentado", "Rosca 21"…).
 */

export type GrupoMuscular =
  | "Peito"
  | "Costas"
  | "Ombro"
  | "Bíceps"
  | "Tríceps"
  | "Pernas"
  | "Glúteos"
  | "Panturrilha"
  | "Abdômen"
  | "Corpo todo";

export interface GuiaExercicio {
  grupo: GrupoMuscular;
  dica: string;
}

/** minúsculas, sem acento, sem "(...)", espaços colapsados. */
function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9°º\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Entrada {
  nomes: string[];
  grupo: GrupoMuscular;
  dica: string;
}

const ESPECIFICOS: Entrada[] = [
  // ---- Peito ----
  {
    nomes: ["Supino Reto com Barra", "Supino Reto Máquina", "Supino Máquina", "Supino Reto"],
    grupo: "Peito",
    dica: "Desça a barra até o meio do peito e empurre sem travar os cotovelos no fim.",
  },
  {
    nomes: ["Supino Inclinado com Barra", "Supino Inclinado com Halteres", "Supino Inclinado"],
    grupo: "Peito",
    dica: "Banco a ~30–45°. Foca a parte de cima do peito; não afunde os ombros.",
  },
  {
    nomes: ["Crucifixo com Halteres", "Crucifixo na Máquina", "Crucifixo", "Crossover", "Crossover no Cabo", "Peck Deck"],
    grupo: "Peito",
    dica: "Abra os braços em arco com o cotovelo levemente flexionado; sinta o peito esticar.",
  },
  // ---- Costas ----
  {
    nomes: ["Remada Baixa", "Remada Baixa (Cabo)", "Remada Sentada", "Remada Sentado"],
    grupo: "Costas",
    dica: "Puxe levando o cotovelo para trás e junte as escápulas; tronco firme, sem balançar.",
  },
  {
    nomes: ["Remada Curvada", "Remada Curvada com Barra", "Remada Unilateral"],
    grupo: "Costas",
    dica: "Coluna reta e tronco inclinado; puxe o peso para a cintura, não para o peito.",
  },
  {
    nomes: ["Puxada Frontal", "Puxada Supinada", "Pulldown"],
    grupo: "Costas",
    dica: "Puxe a barra até a linha do queixo levando o peito à frente; controle na volta.",
  },
  {
    nomes: ["Barra Fixa"],
    grupo: "Costas",
    dica: "Suba até o queixo passar a barra, sem impulso; desça controlando até esticar.",
  },
  // ---- Ombro ----
  {
    nomes: ["Desenvolvimento com Halteres", "Desenvolvimento Máquina", "Desenvolvimento Militar", "Desenvolvimento"],
    grupo: "Ombro",
    dica: "Empurre acima da cabeça sem arquear as costas; desça até a altura das orelhas.",
  },
  {
    nomes: ["Elevação Lateral"],
    grupo: "Ombro",
    dica: "Suba os braços até a linha dos ombros, cotovelo levemente dobrado; sem impulso.",
  },
  {
    nomes: ["Elevação Frontal"],
    grupo: "Ombro",
    dica: "Levante o peso à frente até a altura dos ombros; controle na descida.",
  },
  {
    nomes: ["Encolhimento"],
    grupo: "Ombro",
    dica: "Eleve os ombros em direção às orelhas e segure 1s no topo; não gire os ombros.",
  },
  {
    nomes: ["Remada Alta"],
    grupo: "Ombro",
    dica: "Puxe a barra até a altura do peito com os cotovelos apontando para cima.",
  },
  {
    nomes: ["Crucifixo Inverso"],
    grupo: "Ombro",
    dica: "Tronco inclinado; abra os braços para trás sem usar impulso — foco no ombro posterior.",
  },
  // ---- Bíceps ----
  {
    nomes: ["Rosca Direta", "Rosca Direta com Barra", "Rosca Direta Barra"],
    grupo: "Bíceps",
    dica: "Cotovelos colados no corpo; suba sem balançar o tronco e controle a descida.",
  },
  {
    nomes: ["Rosca Alternada"],
    grupo: "Bíceps",
    dica: "Um braço por vez; gire levemente o punho ao subir e desça devagar.",
  },
  {
    nomes: ["Rosca Martelo"],
    grupo: "Bíceps",
    dica: "Pegada neutra (polegar para cima); cotovelos fixos, sem balanço.",
  },
  {
    nomes: ["Rosca Scott"],
    grupo: "Bíceps",
    dica: "Braços apoiados no banco; não estenda 100% embaixo, para poupar o cotovelo.",
  },
  // ---- Tríceps ----
  {
    nomes: ["Tríceps Corda", "Tríceps Pulley"],
    grupo: "Tríceps",
    dica: "Cotovelos colados ao corpo; estenda só o antebraço e abra a corda no fim.",
  },
  {
    nomes: ["Tríceps Testa"],
    grupo: "Tríceps",
    dica: "Cotovelos apontando para cima e parados; desça a barra até perto da testa.",
  },
  {
    nomes: ["Tríceps Francês"],
    grupo: "Tríceps",
    dica: "Peso atrás da cabeça; estenda os braços para cima mantendo os cotovelos quietos.",
  },
  {
    nomes: ["Mergulho no Banco"],
    grupo: "Tríceps",
    dica: "Cotovelos para trás (não para os lados); desça até ~90° e empurre para cima.",
  },
  // ---- Pernas ----
  {
    nomes: ["Leg Press 45°", "Leg Press", "Leg Press 90°"],
    grupo: "Pernas",
    dica: "Pés na largura dos ombros; desça até ~90° sem tirar o quadril do apoio.",
  },
  {
    nomes: ["Agachamento Livre", "Agachamento com Peso", "Agachamento Smith", "Agachamento Sumô", "Agachamento Búlgaro"],
    grupo: "Pernas",
    dica: "Desça com o peito aberto e o joelho na direção do pé; não deixe o joelho cair para dentro.",
  },
  {
    nomes: ["Hack"],
    grupo: "Pernas",
    dica: "Costas apoiadas na máquina; desça controlando até ~90° e suba sem travar o joelho.",
  },
  {
    nomes: ["Cadeira Extensora"],
    grupo: "Pernas",
    dica: "Estenda o joelho até quase esticar e segure 1s; desça devagar.",
  },
  {
    nomes: ["Cadeira Flexora", "Mesa Flexora"],
    grupo: "Pernas",
    dica: "Puxe o calcanhar em direção ao glúteo; controle a volta sem soltar o peso.",
  },
  {
    nomes: ["Stiff", "Levantamento Terra"],
    grupo: "Pernas",
    dica: "Coluna reta; empurre o quadril para trás descendo o peso rente às pernas.",
  },
  {
    nomes: ["Afundo Alternado", "Afundo (Passada)", "Avanço", "Afundo"],
    grupo: "Pernas",
    dica: "Passo à frente e desça reto; o joelho de trás quase toca o chão, tronco ereto.",
  },
  {
    nomes: ["Cadeira Adutora"],
    grupo: "Pernas",
    dica: "Feche as pernas contra o apoio e controle a abertura — trabalha a parte interna da coxa.",
  },
  // ---- Glúteos ----
  {
    nomes: ["Elevação Pélvica"],
    grupo: "Glúteos",
    dica: "Suba o quadril até o corpo ficar reto e aperte o glúteo 1s no topo.",
  },
  {
    nomes: ["Cadeira Abdutora"],
    grupo: "Glúteos",
    dica: "Abra as pernas contra o apoio e volte devagar — foco no glúteo médio.",
  },
  {
    nomes: ["Glúteo no Cabo", "Abdução no Cabo", "Glúteo no Solo"],
    grupo: "Glúteos",
    dica: "Leve a perna para trás/lado sem arquear a lombar; aperte o glúteo no fim.",
  },
  // ---- Panturrilha ----
  {
    nomes: ["Panturrilha em Pé", "Panturrilha Sentado", "Panturrilha na Cadeira"],
    grupo: "Panturrilha",
    dica: "Suba na ponta do pé o máximo possível e desça alongando bem o calcanhar.",
  },
  // ---- Abdômen ----
  {
    nomes: ["Abdominal Supra", "Abdominal Infra", "Abdominal no Solo", "Elevação de Pernas"],
    grupo: "Abdômen",
    dica: "Movimento curto e controlado; expire ao contrair e não puxe o pescoço.",
  },
  {
    nomes: ["Prancha", "Prancha Isométrica"],
    grupo: "Abdômen",
    dica: "Corpo reto da cabeça aos pés; contraia o abdômen e não deixe o quadril cair.",
  },
];

// Fallback por palavra-chave (ordem importa: mais específico primeiro).
const POR_PALAVRA: { chave: string; grupo: GrupoMuscular; dica: string }[] = [
  { chave: "panturrilha", grupo: "Panturrilha", dica: "Suba na ponta do pé e desça alongando o calcanhar." },
  { chave: "gluteo", grupo: "Glúteos", dica: "Aperte o glúteo no fim do movimento; sem arquear a lombar." },
  { chave: "abdominal", grupo: "Abdômen", dica: "Contração curta e controlada; expire ao subir." },
  { chave: "prancha", grupo: "Abdômen", dica: "Corpo reto; abdômen firme, quadril não cai." },
  { chave: "triceps", grupo: "Tríceps", dica: "Cotovelos fixos; estenda só o antebraço." },
  { chave: "rosca", grupo: "Bíceps", dica: "Cotovelos colados ao corpo; sem balançar o tronco." },
  { chave: "supino", grupo: "Peito", dica: "Desça controlando e empurre sem travar os cotovelos." },
  { chave: "crucifixo", grupo: "Peito", dica: "Abra os braços em arco com o cotovelo levemente dobrado." },
  { chave: "crossover", grupo: "Peito", dica: "Junte as mãos à frente contraindo o peito." },
  { chave: "desenvolvimento", grupo: "Ombro", dica: "Empurre acima da cabeça sem arquear as costas." },
  { chave: "elevacao lateral", grupo: "Ombro", dica: "Suba os braços até a linha dos ombros, sem impulso." },
  { chave: "elevacao frontal", grupo: "Ombro", dica: "Levante à frente até a altura dos ombros." },
  { chave: "encolhimento", grupo: "Ombro", dica: "Eleve os ombros às orelhas e segure no topo." },
  { chave: "remada", grupo: "Costas", dica: "Puxe o cotovelo para trás e junte as escápulas." },
  { chave: "puxada", grupo: "Costas", dica: "Puxe até o queixo levando o peito à frente." },
  { chave: "pulldown", grupo: "Costas", dica: "Puxe a barra ao peito controlando a volta." },
  { chave: "barra fixa", grupo: "Costas", dica: "Suba até o queixo passar a barra, sem impulso." },
  { chave: "leg press", grupo: "Pernas", dica: "Desça até ~90° sem tirar o quadril do apoio." },
  { chave: "agachamento", grupo: "Pernas", dica: "Peito aberto; joelho na direção do pé." },
  { chave: "cadeira extensora", grupo: "Pernas", dica: "Estenda o joelho e segure 1s no topo." },
  { chave: "flexora", grupo: "Pernas", dica: "Puxe o calcanhar em direção ao glúteo." },
  { chave: "adutora", grupo: "Pernas", dica: "Feche as pernas contra o apoio, controlando a volta." },
  { chave: "abdutora", grupo: "Glúteos", dica: "Abra as pernas contra o apoio; foco no glúteo médio." },
  { chave: "afundo", grupo: "Pernas", dica: "Desça reto; joelho de trás quase toca o chão." },
  { chave: "avanco", grupo: "Pernas", dica: "Passo à frente e desça com o tronco ereto." },
  { chave: "stiff", grupo: "Pernas", dica: "Empurre o quadril para trás com a coluna reta." },
  { chave: "hack", grupo: "Pernas", dica: "Costas apoiadas; desça controlando até ~90°." },
];

// Mapa nome-normalizado → guia, montado uma vez.
const MAPA: Map<string, GuiaExercicio> = (() => {
  const m = new Map<string, GuiaExercicio>();
  for (const e of ESPECIFICOS) {
    for (const nome of e.nomes) {
      m.set(normalizar(nome), { grupo: e.grupo, dica: e.dica });
    }
  }
  return m;
})();

/**
 * Guia (grupo muscular + dica) para um nome de exercício, ou null se não houver
 * correspondência confiável. Tenta o mapa específico e, depois, o fallback por
 * palavra-chave.
 */
export function guiaDoExercicio(nome: string | null | undefined): GuiaExercicio | null {
  if (!nome) return null;
  const chave = normalizar(nome);
  if (!chave) return null;

  const exato = MAPA.get(chave);
  if (exato) return exato;

  for (const p of POR_PALAVRA) {
    if (chave.includes(p.chave)) {
      return { grupo: p.grupo, dica: p.dica };
    }
  }
  return null;
}
