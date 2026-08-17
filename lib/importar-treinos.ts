// Importação de treinos-modelo por planilha (.xlsx/.csv), reusando a mesma
// infraestrutura da importação de alunos (leitura de arquivo, geração de
// modelo). Formato: UMA LINHA POR EXERCÍCIO, agrupada por nome de treino.
//
// O nome do treino pode ser repetido em toda linha do bloco OU preenchido só na
// primeira (o resto em branco herda o anterior — "carry-down"), que é como a
// maioria monta no Excel. A função é pura e testável (tests/importar-treinos),
// e é a MESMA que a pré-visualização no navegador e a Server Action usam.

import { gerarXlsx } from "./xlsx-minimo";
import { linhasDoArquivo, parsearCsv } from "./importar-alunos";

export interface ExercicioImportado {
  nome_exercicio: string;
  series: number;
  repeticoes: string;
  carga_kg: number;
  descanso_segundos: number | null;
  observacoes: string | null;
}

export interface TreinoImportado {
  /** Primeira linha do bloco (para o relatório apontar onde está no Excel). */
  linha: number;
  nome_treino: string;
  modalidade: string | null;
  objetivo: string | null;
  nivel: string | null;
  publico_alvo: string | null;
  exercicios: ExercicioImportado[];
}

export interface ProblemaImport {
  linha: number;
  motivo: string;
}

export interface ResultadoAnaliseTreino {
  treinos: TreinoImportado[];
  erros: ProblemaImport[];
  avisos: ProblemaImport[];
  totalLinhas: number;
}

export const CABECALHO_MODELO_TREINO = [
  "treino",
  "modalidade",
  "objetivo",
  "nivel",
  "publico_alvo",
  "exercicio",
  "series",
  "repeticoes",
  "carga_kg",
  "descanso_segundos",
  "observacoes",
];

/** Tetos por importação — evita estourar o tempo de função da Vercel. */
export const MAX_LINHAS_IMPORT_TREINO = 2000;
export const MAX_TREINOS_IMPORT = 200;

/** Remove acento e baixa a caixa, para casar cabeçalhos de forma tolerante. */
function chaveColuna(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

const ALIASES: Record<string, string> = {
  treino: "treino",
  nometreino: "treino",
  ficha: "treino",
  modalidade: "modalidade",
  objetivo: "objetivo",
  nivel: "nivel",
  publicoalvo: "publico_alvo",
  publico: "publico_alvo",
  exercicio: "exercicio",
  nomeexercicio: "exercicio",
  series: "series",
  serie: "series",
  repeticoes: "repeticoes",
  reps: "repeticoes",
  rep: "repeticoes",
  carga: "carga_kg",
  cargakg: "carga_kg",
  peso: "carga_kg",
  descanso: "descanso_segundos",
  descansosegundos: "descanso_segundos",
  descansoseg: "descanso_segundos",
  observacoes: "observacoes",
  obs: "observacoes",
  observacao: "observacoes",
};

const EXEMPLOS_MODELO: string[][] = [
  ["Treino A - Peito e Tríceps", "Musculação", "Hipertrofia", "Intermediário", "Geral", "Supino reto", "4", "10", "40", "60", "controlar a descida"],
  ["", "", "", "", "", "Crucifixo com halteres", "3", "12", "20", "45", ""],
  ["", "", "", "", "", "Tríceps corda", "4", "12", "", "45", ""],
  ["Treino B - Costas", "Musculação", "", "", "", "Puxada frontal", "4", "10", "", "60", ""],
];

/** Modelo em .xlsx (colunas como Texto — Excel não estraga números). */
export function gerarModeloTreinoXlsx(): Uint8Array {
  return gerarXlsx(CABECALHO_MODELO_TREINO, EXEMPLOS_MODELO, {
    nomeAba: "Treinos",
    largura: 18,
  });
}

/** Modelo em CSV (separador `;`, BOM para o Excel BR ler o UTF-8). */
export function gerarModeloTreinoCsv(): string {
  const linhas = [CABECALHO_MODELO_TREINO, ...EXEMPLOS_MODELO];
  return "﻿" + linhas.map((l) => l.join(";")).join("\r\n") + "\r\n";
}

function inteiroEntre(bruto: string, min: number, max: number, padrao: number): number {
  const n = Math.trunc(Number(bruto.replace(",", ".")));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

/** Analisa a grade de células (xlsx/csv já lido) em treinos-modelo. */
export function analisarLinhasTreino(grade: string[][]): ResultadoAnaliseTreino {
  const linhas = grade
    .map((celulas, i) => ({ celulas, numero: i + 1 }))
    .filter((l) => l.celulas.some((c) => c.trim() !== ""));

  const erros: ProblemaImport[] = [];
  const avisos: ProblemaImport[] = [];

  if (linhas.length === 0) {
    return { treinos: [], erros: [{ linha: 0, motivo: "Planilha vazia." }], avisos, totalLinhas: 0 };
  }

  const cabecalho = linhas[0].celulas.map((c) => ALIASES[chaveColuna(c)] ?? "");
  const idx = (nome: string) => cabecalho.indexOf(nome);
  if (idx("treino") === -1 || idx("exercicio") === -1) {
    return {
      treinos: [],
      erros: [{ linha: 1, motivo: 'Faltam as colunas "treino" e/ou "exercicio" no cabeçalho. Baixe o modelo.' }],
      avisos,
      totalLinhas: 0,
    };
  }

  const dados = linhas.slice(1);
  if (dados.length > MAX_LINHAS_IMPORT_TREINO) {
    erros.push({
      linha: 0,
      motivo: `A planilha tem ${dados.length} linhas. Importe no máximo ${MAX_LINHAS_IMPORT_TREINO} por vez.`,
    });
  }

  // Agrupa por treino, preservando a ordem de aparição. `carry-down`: linha com
  // treino em branco herda o nome do bloco anterior.
  const ordem: string[] = [];
  const porChave = new Map<string, TreinoImportado>();
  let ultimoNome = "";

  dados.slice(0, MAX_LINHAS_IMPORT_TREINO).forEach(({ celulas, numero: nLinha }) => {
    const val = (nome: string) => (idx(nome) >= 0 ? (celulas[idx(nome)] ?? "").trim() : "");

    const nomeCelula = val("treino");
    const nomeTreino = nomeCelula || ultimoNome;
    if (!nomeTreino) {
      erros.push({ linha: nLinha, motivo: "Exercício sem treino: preencha a coluna \"treino\"." });
      return;
    }
    ultimoNome = nomeTreino;

    const nomeExercicio = val("exercicio");
    if (!nomeExercicio) {
      // Linha só com dados de treino e sem exercício: aceitável só se abre um
      // treino novo (que ainda vai receber exercícios nas linhas seguintes).
      if (nomeCelula) {
        avisos.push({ linha: nLinha, motivo: `Treino "${nomeTreino}" sem exercício nesta linha.` });
      } else {
        erros.push({ linha: nLinha, motivo: "Exercício em branco." });
      }
      // Garante que o treino exista no mapa mesmo sem exercício ainda.
      const ch0 = chaveColuna(nomeTreino);
      if (!porChave.has(ch0)) {
        ordem.push(ch0);
        porChave.set(ch0, {
          linha: nLinha, nome_treino: nomeTreino,
          modalidade: val("modalidade") || null, objetivo: val("objetivo") || null,
          nivel: val("nivel") || null, publico_alvo: val("publico_alvo") || null,
          exercicios: [],
        });
      }
      return;
    }

    const chave = chaveColuna(nomeTreino);
    let treino = porChave.get(chave);
    if (!treino) {
      treino = {
        linha: nLinha,
        nome_treino: nomeTreino.slice(0, 120),
        modalidade: val("modalidade") || null,
        objetivo: val("objetivo") || null,
        nivel: val("nivel") || null,
        publico_alvo: val("publico_alvo") || null,
        exercicios: [],
      };
      ordem.push(chave);
      porChave.set(chave, treino);
    } else {
      // Complementa metadados do treino se vierem numa linha posterior.
      treino.modalidade ||= val("modalidade") || null;
      treino.objetivo ||= val("objetivo") || null;
      treino.nivel ||= val("nivel") || null;
      treino.publico_alvo ||= val("publico_alvo") || null;
    }

    const descBruto = val("descanso_segundos");
    const desc = descBruto ? inteiroEntre(descBruto, 0, 3600, 0) : 0;
    treino.exercicios.push({
      nome_exercicio: nomeExercicio.slice(0, 120),
      series: val("series") ? inteiroEntre(val("series"), 1, 20, 3) : 3,
      repeticoes: (val("repeticoes") || "12").slice(0, 20),
      carga_kg: val("carga_kg") ? Math.max(0, Number(val("carga_kg").replace(",", ".")) || 0) : 0,
      descanso_segundos: desc > 0 ? desc : null,
      observacoes: val("observacoes") || null,
    });
  });

  // Treino sem nenhum exercício válido não pode ser importado.
  const treinos: TreinoImportado[] = [];
  for (const ch of ordem) {
    const t = porChave.get(ch)!;
    if (t.exercicios.length === 0) {
      erros.push({ linha: t.linha, motivo: `Treino "${t.nome_treino}" ficou sem exercícios.` });
      continue;
    }
    treinos.push(t);
  }

  if (treinos.length > MAX_TREINOS_IMPORT) {
    erros.push({
      linha: 0,
      motivo: `A planilha tem ${treinos.length} treinos. Importe no máximo ${MAX_TREINOS_IMPORT} por vez.`,
    });
    return { treinos: [], erros, avisos, totalLinhas: dados.length };
  }

  return { treinos, erros, avisos, totalLinhas: dados.length };
}

/** Atalho a partir de um CSV em texto (usado em teste e em fallback). */
export function analisarPlanilhaTreino(texto: string): ResultadoAnaliseTreino {
  return analisarLinhasTreino(parsearCsv(texto));
}

export { linhasDoArquivo };
