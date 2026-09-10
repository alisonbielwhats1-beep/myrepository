import type { Treino } from "./types";

/**
 * Visibilidade com que um treino-modelo NASCE (criado, duplicado ou importado).
 *
 * Era `privado`, e essa era a raiz da queixa da academia: o instrutor cadastrava
 * a ficha, ela sumia para todo mundo, e a recepção acabava redigitando à mão um
 * treino que já existia no sistema. `equipe` inclui dono, gerente, instrutores e
 * — desde a migration 095 — a recepção, então o treino nasce pronto para ser
 * atribuído por quem estiver no balcão. Quem quiser esconder ainda pode marcar
 * "Só eu (privado)" no formulário ou em "Gerenciar acesso".
 *
 * Escrito explicitamente pela aplicação (não depende do DEFAULT da coluna), para
 * o comportamento valer mesmo antes da migration 106 ser aplicada em produção.
 */
export const VISIBILIDADE_PADRAO_MODELO = "equipe" as const;

/** Nível efetivo de um treino-modelo, para selo e filtro na biblioteca. */
export type NivelTreino =
  | "plataforma"
  | "privado"
  | "selecionado"
  | "equipe"
  | "academia";

/**
 * Classifica o NÍVEL de um treino-modelo para as abas e o selo da biblioteca,
 * combinando os dois eixos já desconflacionados:
 *   • ORIGEM — "plataforma" vem de `origem_tipo='gestacad'` (migration 076),
 *     fonte única de verdade (antes derivava de duas fontes);
 *   • VISIBILIDADE — os níveis de tenant vêm de `visibilidade` (migration 077):
 *     privado / equipe / academia.
 *
 * Fallback para dados anteriores às migrações (sem `origem_tipo`, com os valores
 * legados `instrutor`/`plataforma`): reproduz a classificação antiga, então
 * nenhum treino muda de aba durante a transição.
 *
 * Aceita qualquer objeto com os campos relevantes (não exige o Treino inteiro),
 * para ser reutilizável em contextos parciais e nos testes.
 */
export function nivelDoTreino(
  t: Pick<Treino, "origem_tipo" | "academia_id" | "visibilidade">
): NivelTreino {
  const ehPlataforma = t.origem_tipo
    ? t.origem_tipo === "gestacad"
    : t.visibilidade === "plataforma" || !t.academia_id;
  if (ehPlataforma) return "plataforma";

  switch (t.visibilidade) {
    case "academia":
      return "academia";
    case "equipe":
      return "equipe";
    case "selecionado":
      return "selecionado";
    case "privado":
    case "instrutor": // legado (pré-077)
      return "privado";
    default:
      // Sem visibilidade conhecida: default seguro é privado (menor exposição).
      return "privado";
  }
}

/** Pessoa da equipe do painel que pode ter autorado treinos-modelo. */
export type AutorTreino = {
  id: string;
  nome: string;
  papel?: string | null;
};

/**
 * Um bloco da visão "Por instrutor": o autor e todos os modelos dele.
 * `chave` é estável e serve de key no React e de id do accordion.
 */
export type GrupoAutorTreinos = {
  chave: string;
  /** `criado_por` do autor; null quando o treino não registra autoria. */
  autorId: string | null;
  nome: string;
  papel: string | null;
  /** Bloco dos modelos curados pela plataforma (sem autor na academia). */
  ehPlataforma: boolean;
  /** Bloco dos treinos cuja autoria se perdeu (importação antiga, por ex.). */
  ehSemAutor: boolean;
  treinos: Treino[];
};

const CHAVE_PLATAFORMA = "__gestacad__";
const CHAVE_SEM_AUTOR = "__sem_autor__";

/** Nome de exibição do autor de um treino, sem depender da lista da equipe. */
function nomeNoTreino(t: Treino): string | null {
  const n = t.profissional_nome?.trim();
  return n ? n : null;
}

/**
 * Agrupa os treinos-modelo POR AUTOR, para a visão "Por instrutor" da
 * biblioteca — a recepção abre a aba e já encontra "Rodrigo (12)" e
 * "Vinícius (8)" em vez de caçar num monte único de cards.
 *
 * Regras de agrupamento, nesta ordem:
 *   1. modelo da plataforma (nivelDoTreino === 'plataforma') → bloco próprio,
 *      sempre por último (não é treino de ninguém da academia);
 *   2. `criado_por` preenchido → um bloco por pessoa. O nome vem da equipe
 *      atual (`perfis_admin`, sempre atualizado); se a pessoa saiu da academia,
 *      cai para o `profissional_nome` gravado no treino;
 *   3. sem `criado_por` mas com `profissional_nome` → agrupa pelo nome (dados
 *      importados antes da autoria existir);
 *   4. nada disso → bloco "Sem autor definido", logo antes do da plataforma.
 *
 * `incluirEquipeSemTreinos` acrescenta quem ainda não tem nenhum modelo
 * visível: a recepção enxerga a equipe inteira e sabe de quem falta ficha, em
 * vez de achar que a pessoa não existe.
 *
 * Ordena os blocos por nome (pt-BR) e preserva a ordem original dos treinos
 * dentro de cada bloco — quem chama já ordenou/filtrou a lista.
 */
export function agruparTreinosPorAutor(
  treinos: Treino[],
  equipe: AutorTreino[] = [],
  opcoes: { incluirEquipeSemTreinos?: boolean } = {}
): GrupoAutorTreinos[] {
  const porId = new Map(equipe.map((p) => [p.id, p]));
  const grupos = new Map<string, GrupoAutorTreinos>();

  const obter = (
    chave: string,
    base: Omit<GrupoAutorTreinos, "chave" | "treinos">
  ): GrupoAutorTreinos => {
    const existente = grupos.get(chave);
    if (existente) return existente;
    const novo: GrupoAutorTreinos = { chave, ...base, treinos: [] };
    grupos.set(chave, novo);
    return novo;
  };

  // A equipe entra primeiro para que um bloco vazio ainda apareça (e para que o
  // nome/papel venham do perfil atual, não do texto congelado no treino).
  if (opcoes.incluirEquipeSemTreinos) {
    for (const p of equipe) {
      obter(`id:${p.id}`, {
        autorId: p.id,
        nome: p.nome?.trim() || "Sem nome",
        papel: p.papel ?? null,
        ehPlataforma: false,
        ehSemAutor: false,
      });
    }
  }

  for (const t of treinos) {
    // Ficha de aluno não é modelo de biblioteca — nunca entra nesta visão.
    if (t.aluno_id) continue;

    if (nivelDoTreino(t) === "plataforma") {
      obter(CHAVE_PLATAFORMA, {
        autorId: null,
        nome: "Modelos GestAcad",
        papel: null,
        ehPlataforma: true,
        ehSemAutor: false,
      }).treinos.push(t);
      continue;
    }

    const autorId = t.criado_por?.trim() || null;
    if (autorId) {
      const perfil = porId.get(autorId);
      obter(`id:${autorId}`, {
        autorId,
        nome: perfil?.nome?.trim() || nomeNoTreino(t) || "Sem autor definido",
        papel: perfil?.papel ?? null,
        ehPlataforma: false,
        ehSemAutor: false,
      }).treinos.push(t);
      continue;
    }

    const nome = nomeNoTreino(t);
    if (nome) {
      obter(`nome:${nome.toLocaleLowerCase("pt-BR")}`, {
        autorId: null,
        nome,
        papel: null,
        ehPlataforma: false,
        ehSemAutor: false,
      }).treinos.push(t);
      continue;
    }

    obter(CHAVE_SEM_AUTOR, {
      autorId: null,
      nome: "Sem autor definido",
      papel: null,
      ehPlataforma: false,
      ehSemAutor: true,
    }).treinos.push(t);
  }

  // Pessoas em ordem alfabética; "Sem autor" e os modelos da plataforma no fim,
  // nesta ordem — posição fixa, para a recepção sempre achar no mesmo lugar.
  const peso = (g: GrupoAutorTreinos) =>
    g.ehPlataforma ? 2 : g.ehSemAutor ? 1 : 0;
  return Array.from(grupos.values()).sort(
    (a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR")
  );
}
