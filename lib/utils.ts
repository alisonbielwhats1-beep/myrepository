import {
  DecisaoAcesso,
  MensalidadeParaAcesso,
  OrigemAcesso,
  PoliticaInadimplencia,
  ResultadoAcesso,
  StatusFinanceiro,
  StatusMatricula,
} from "./types";

/** Formata um número como moeda brasileira (BRL).
 *  compacto=true → sem casas decimais (para KPIs e totais de dashboard). */
export function formatBRL(
  value: number | null | undefined,
  { compacto = false }: { compacto?: boolean } = {}
): string {
  const v = typeof value === "number" ? value : 0;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: compacto ? 0 : 2,
    maximumFractionDigits: compacto ? 0 : 2,
  });
}

/** Retorna a hora no formato HH:mm a partir de um ISO string. */
export function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Retorna data e hora curtas (dd/mm HH:mm). */
export function formatDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "há X min / há X h" a partir de uma data. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

/** Cor de acento por origem de acesso (para gráficos e badges). */
export const CORES_ORIGEM: Record<OrigemAcesso, string> = {
  Direto: "#adff42",
  Gympass: "#3ee6ff",
  TotalPass: "#f81cc0",
};

/** Classe de badge por status de matrícula. */
export function badgeStatusMatricula(status: StatusMatricula): string {
  switch (status) {
    case "ativa":
      return "bg-volt-500/15 text-volt-300 border-volt-500/30";
    case "pendente":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "trancada":
      return "bg-cyanx-500/15 text-cyanx-400 border-cyanx-500/30";
    case "cancelada":
      return "bg-red-900/30 text-red-400 border-red-800/50";
    default:
      return "bg-ink-600 text-slate-300 border-ink-500";
  }
}

/**
 * Data de hoje (YYYY-MM-DD) no fuso da academia.
 *
 * HELPER CENTRAL DE DATA. Toda comparação de vencimento — ficha do aluno,
 * financeiro, notificações e recepção — precisa passar por aqui. Usar
 * `new Date().toISOString()` compara em UTC e, entre 21h e meia-noite no
 * horário de Brasília, já contabiliza o dia seguinte: uma cobrança que vence
 * hoje apareceria como vencida antes do fim do dia.
 */
export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Calcula o status financeiro do aluno a partir de suas mensalidades.
 * Recebe apenas os campos necessários para evitar over-fetch.
 *
 * Datas comparadas sempre em America/Sao_Paulo (ver `hojeSaoPaulo`):
 *  - Sem mensalidades → "em_dia"
 *  - Existe pendente com data > hoje → "em_dia"  (ainda não venceu)
 *  - Existe pendente com data === hoje → "pendente" (vence hoje, não é atraso)
 *  - Existe pendente com data < hoje → "inadimplente"
 */
export function calcularStatusFinanceiro(
  mensalidades: Array<{ status: string; data: string }>
): StatusFinanceiro {
  const hoje = hojeSaoPaulo();
  const pendentes = mensalidades.filter((m) => m.status === "pendente");
  if (pendentes.length === 0) return "em_dia";
  const vencidas = pendentes.filter((m) => m.data < hoje);
  if (vencidas.length > 0) return "inadimplente";
  const venceHoje = pendentes.some((m) => m.data === hoje);
  return venceHoje ? "pendente" : "em_dia";
}

const MOTIVOS_CADASTRAIS: Record<string, string> = {
  pendente: "Matrícula pendente — plano não confirmado",
  trancada: "Matrícula trancada",
  cancelada: "Matrícula cancelada",
  inativa: "Matrícula inativa",
};

/**
 * ÚNICO lugar que decide acesso. Recepção manual, Gympass/Wellhub e TotalPass
 * apenas reúnem os dados, chamam esta função e gravam o retorno — nenhuma rota
 * reimplementa a regra.
 *
 * Ordem da decisão:
 *   1. Status cadastral. Qualquer coisa diferente de "ativa" bloqueia, e a
 *      política financeira nem chega a ser consultada — cadastro e finanças
 *      permanecem separados.
 *   2. Só com matrícula ativa a situação financeira é avaliada.
 *   3. Conta como vencida apenas mensalidade com status "pendente" e vencimento
 *      anterior a hoje em America/Sao_Paulo. Paga, cancelada e futura ficam de
 *      fora por construção.
 *   4. Havendo vencidas, a mais antiga vira a referência (dias de atraso,
 *      competência e vencimento) e a política da academia decide o resultado.
 *
 * Nenhuma cobrança é alterada aqui — a função é somente de leitura.
 */
export function decidirAcesso(
  statusCadastral: StatusMatricula,
  politica: PoliticaInadimplencia = "liberar",
  mensalidades: MensalidadeParaAcesso[] = []
): DecisaoAcesso {
  const semFinanceiro = {
    politicaAplicada: null,
    mensalidadeId: null,
    competencia: null,
    vencimento: null,
    diasAtraso: 0,
    quantidadeVencida: 0,
    totalVencido: 0,
  } as const;

  // 1. Regra cadastral, inalterada desde a Fase 4.
  if (statusCadastral !== "ativa") {
    return {
      resultado: "bloqueado",
      motivo: MOTIVOS_CADASTRAIS[statusCadastral] ?? "Matrícula não está ativa",
      ...semFinanceiro,
    };
  }

  // 2 e 3. Só mensalidade pendente e já vencida entra na conta.
  const hoje = hojeSaoPaulo();
  const vencidas = mensalidades
    .filter((m) => m.status === "pendente" && m.data < hoje)
    .sort((a, b) => a.data.localeCompare(b.data));

  if (vencidas.length === 0) {
    return { resultado: "liberado", motivo: null, ...semFinanceiro };
  }

  // 4. A mais antiga é a referência.
  const maisAntiga = vencidas[0];
  const diasAtraso = Math.floor(
    (Date.parse(`${hoje}T00:00:00Z`) - Date.parse(`${maisAntiga.data}T00:00:00Z`)) /
      86_400_000
  );
  const totalVencido = vencidas.reduce((s, m) => s + Number(m.valor), 0);

  const financeiro = {
    politicaAplicada: politica,
    mensalidadeId: maisAntiga.id,
    competencia: maisAntiga.competencia,
    vencimento: maisAntiga.data,
    diasAtraso,
    quantidadeVencida: vencidas.length,
    totalVencido,
  };

  const resumo =
    `${vencidas.length} mensalidade(s) vencida(s) — ` +
    `${formatBRL(totalVencido)}, ${diasAtraso} dia(s) de atraso`;

  if (politica === "bloquear") {
    return {
      resultado: "bloqueado",
      motivo: `Acesso bloqueado pela política da academia: ${resumo}`,
      ...financeiro,
    };
  }

  if (politica === "alertar") {
    return { resultado: "alerta", motivo: resumo, ...financeiro };
  }

  // "liberar": entra normalmente; o motivo fica no histórico apenas como registro.
  return {
    resultado: "liberado",
    motivo: `Liberado pela política da academia: ${resumo}`,
    ...financeiro,
  };
}

/** Mapeia o resultado da decisão para o enum gravado em acessos_catraca. */
export function statusLiberacaoDe(resultado: ResultadoAcesso):
  | "liberado"
  | "alerta"
  | "negado" {
  if (resultado === "liberado") return "liberado";
  if (resultado === "alerta") return "alerta";
  return "negado";
}

/** Classe de badge por status financeiro. */
export function badgeStatusFinanceiro(status: StatusFinanceiro): string {
  switch (status) {
    case "em_dia":
      return "bg-volt-500/15 text-volt-300 border-volt-500/30";
    case "pendente":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "inadimplente":
      return "bg-red-500/15 text-red-400 border-red-500/30";
  }
}

/** Junta classes condicionalmente (mini clsx). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Mascara um segredo de webhook para exibição segura no frontend.
 * Mostra apenas os últimos 4 caracteres: ••••••••XXXX
 * Retorna string vazia se o segredo não estiver configurado.
 */
export function mascarar(secret: string | null | undefined): string {
  if (!secret) return "";
  return "••••••••" + secret.slice(-4).toUpperCase();
}
