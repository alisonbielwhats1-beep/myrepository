import {
  ClassificacaoRetencao,
  ConfigRetencao,
  DecisaoAcesso,
  MensalidadeParaAcesso,
  OrigemAcesso,
  PoliticaInadimplencia,
  ResultadoAcesso,
  ResultadoRetencao,
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
  qr: "#f5c451",
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
  return dataSaoPaulo(new Date());
}

/** Converte um instante (ISO ou Date) para a data-calendário YYYY-MM-DD em SP. */
export function dataSaoPaulo(instante: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof instante === "string" ? new Date(instante) : instante);
}

/**
 * Converte um instante (ISO ou Date) para a hora do dia (0–23) em SP.
 *
 * Mesmo motivo de `dataSaoPaulo`: `Date.getHours()` usa o fuso do processo
 * (UTC no servidor), não o da academia — um acesso às 22h39 em São Paulo
 * aparecia como 01h (do dia seguinte, em UTC), embaralhando "acessos de
 * hoje" e "horário de pico" com o dia/hora errados.
 */
export function horaSaoPaulo(instante: string | Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(typeof instante === "string" ? new Date(instante) : instante);
  return Number(partes.find((p) => p.type === "hour")?.value ?? 0);
}

/** Dias inteiros entre duas datas YYYY-MM-DD (ate - de). */
export function diasEntre(de: string, ate: string): number {
  return Math.floor(
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000
  );
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

// ---------------------------------------------------------------------------
// Fase 6 — retenção
// ---------------------------------------------------------------------------

const ROTULO_RETENCAO: Record<ClassificacaoRetencao, string> = {
  normal: "normal",
  atencao: "atenção",
  em_risco: "em risco",
  sumido: "sumido",
};

/** Aplica os limites da academia a uma quantidade de dias de ausência. */
function faixaPorDias(dias: number, config: ConfigRetencao): ClassificacaoRetencao {
  if (dias >= config.diasSumido) return "sumido";
  if (dias >= config.diasRisco) return "em_risco";
  if (dias >= config.diasAtencao) return "atencao";
  return "normal";
}

/**
 * ÚNICA função que classifica retenção. Dashboard e Retenção consomem esta
 * função e a mesma consulta agregada — nenhuma página recalcula por conta.
 *
 * Regras:
 *   • Só matrícula ativa entra. Trancada, inativa, pendente e cancelada
 *     retornam null (fora da retenção), sem virar "normal" por engano.
 *   • Nunca acessou e dentro da tolerância → normal. A tolerância evita a
 *     classificação precoce do recém-matriculado.
 *   • Nunca acessou e tolerância vencida → classifica pelos dias TOTAIS desde
 *     a matrícula. A tolerância adia a avaliação, não desloca os limites.
 *   • Já acessou → conta desde o último acesso.
 *   • Inadimplência não entra aqui: dívida é informação complementar e não
 *     altera classificação de ausência.
 *
 * Todas as comparações em America/Sao_Paulo.
 */
export function classificarRetencao(
  aluno: { criado_em: string; status_matricula: StatusMatricula },
  ultimoAcesso: string | null,
  config: ConfigRetencao
): ResultadoRetencao | null {
  if (aluno.status_matricula !== "ativa") return null;

  const hoje = hojeSaoPaulo();
  const diasDesdeMatricula = Math.max(
    0,
    diasEntre(dataSaoPaulo(aluno.criado_em), hoje)
  );

  // --- Nunca acessou ---
  if (!ultimoAcesso) {
    if (diasDesdeMatricula <= config.toleranciaNovoAluno) {
      return {
        classificacao: "normal",
        ultimoAcesso: null,
        diasSemAcesso: null,
        nuncaAcessou: true,
        diasDesdeMatricula,
        explicacao: `Nunca acessou — matriculado há ${diasDesdeMatricula} dia(s)`,
      };
    }

    // Tolerância vencida: os limites valem sobre o tempo total de matrícula.
    const classificacao = faixaPorDias(diasDesdeMatricula, config);
    const desdeFimTolerancia = diasDesdeMatricula - config.toleranciaNovoAluno;
    return {
      classificacao,
      ultimoAcesso: null,
      diasSemAcesso: null,
      nuncaAcessou: true,
      diasDesdeMatricula,
      explicacao:
        `Nunca acessou — tolerância encerrada há ${desdeFimTolerancia} dia(s)` +
        (classificacao === "normal" ? "" : ` — ${ROTULO_RETENCAO[classificacao]}`),
    };
  }

  // --- Já acessou alguma vez ---
  const diasSemAcesso = Math.max(0, diasEntre(dataSaoPaulo(ultimoAcesso), hoje));
  const classificacao = faixaPorDias(diasSemAcesso, config);

  const explicacao =
    diasSemAcesso === 0
      ? "Acessou hoje"
      : `Sem acesso há ${diasSemAcesso} dia(s)` +
        (classificacao === "normal" ? "" : ` — ${ROTULO_RETENCAO[classificacao]}`);

  return {
    classificacao,
    ultimoAcesso,
    diasSemAcesso,
    nuncaAcessou: false,
    diasDesdeMatricula,
    explicacao,
  };
}

/** Rótulo curto de cada classificação, para chips e listas. */
export const ROTULOS_RETENCAO: Record<ClassificacaoRetencao, string> = {
  normal: "Normal",
  atencao: "Atenção",
  em_risco: "Em risco",
  sumido: "Sumido",
};

/** Classe de badge por classificação de retenção. */
export function badgeRetencao(classificacao: ClassificacaoRetencao): string {
  switch (classificacao) {
    case "sumido":
      return "border-red-500/30 bg-red-500/10 text-red-400";
    case "em_risco":
      return "border-magenta-500/30 bg-magenta-500/10 text-magenta-400";
    case "atencao":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-volt-500/30 bg-volt-500/10 text-volt-300";
  }
}

/** Lê os limites da academia com fallback nos defaults da migration 029. */
export function configRetencaoDe(academia: {
  dias_atencao_sem_acesso?: number | null;
  dias_risco_sem_acesso?: number | null;
  dias_sumido_sem_acesso?: number | null;
  tolerancia_novo_aluno_dias?: number | null;
}): ConfigRetencao {
  return {
    diasAtencao: academia.dias_atencao_sem_acesso ?? 7,
    diasRisco: academia.dias_risco_sem_acesso ?? 10,
    diasSumido: academia.dias_sumido_sem_acesso ?? 14,
    toleranciaNovoAluno: academia.tolerancia_novo_aluno_dias ?? 7,
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

/**
 * Classe de badge por status de ACESSO (resultado de decidirAcesso) — usada
 * na Home do aluno (Bloco 2) para separar visualmente "posso entrar?" de
 * status cadastral e financeiro, que já têm seus próprios badges acima.
 */
export function badgeStatusAcesso(resultado: ResultadoAcesso): string {
  switch (resultado) {
    case "liberado":
      return "bg-volt-500/15 text-volt-300 border-volt-500/30";
    case "alerta":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "bloqueado":
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
