import { OrigemAcesso, StatusMatricula } from "./types";

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
    default:
      return "bg-ink-600 text-slate-300 border-ink-500";
  }
}

/** Junta classes condicionalmente (mini clsx). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
