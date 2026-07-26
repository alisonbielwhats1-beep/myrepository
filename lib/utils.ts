import { OrigemAcesso, StatusFinanceiro, StatusMatricula } from "./types";

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
 * Calcula o status financeiro do aluno a partir de suas mensalidades.
 * Recebe apenas os campos necessários para evitar over-fetch.
 *
 * Regra MVP (Fase 5 adicionará tolerância configurável):
 *  - Sem mensalidades → "em_dia"
 *  - Existe pendente com data > hoje → "em_dia"  (ainda não venceu)
 *  - Existe pendente com data === hoje → "pendente"
 *  - Existe pendente com data < hoje → "inadimplente"
 */
export function calcularStatusFinanceiro(
  mensalidades: Array<{ status: string; data: string }>
): StatusFinanceiro {
  const hoje = new Date().toISOString().slice(0, 10);
  const pendentes = mensalidades.filter((m) => m.status === "pendente");
  if (pendentes.length === 0) return "em_dia";
  const vencidas = pendentes.filter((m) => m.data < hoje);
  if (vencidas.length > 0) return "inadimplente";
  const venceHoje = pendentes.some((m) => m.data === hoje);
  return venceHoje ? "pendente" : "em_dia";
}

/**
 * Decide se o acesso deve ser liberado com base no status cadastral.
 * Fase 5 receberá statusFinanceiro + política configurável como parâmetros.
 * Por enquanto: apenas status_matricula === "ativa" libera.
 */
export function decidirAcesso(statusCadastral: StatusMatricula): {
  liberado: boolean;
  observacao: string | null;
} {
  if (statusCadastral === "ativa") {
    return { liberado: true, observacao: null };
  }
  const motivos: Record<string, string> = {
    pendente: "Matrícula pendente — plano não confirmado",
    trancada: "Matrícula trancada",
    cancelada: "Matrícula cancelada",
    inativa: "Matrícula inativa",
  };
  return {
    liberado: false,
    observacao: motivos[statusCadastral] ?? "Matrícula não está ativa",
  };
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
