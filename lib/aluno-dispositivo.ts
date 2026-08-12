// Helpers de dispositivo/PWA para a área do aluno (login-less). Tudo roda no
// cliente: guardam/leem o "acesso lembrado" naquele aparelho e detectam
// iOS/standalone para a instrução de instalação. Nunca usados no servidor.

/** Chave do acesso lembrado no aparelho (o link pessoal do aluno). */
export const LS_ACESSO_ALUNO = "gestacad_aluno_acesso";
/** Chave de "não insistir na instalação" após o aluno dispensar. */
export const LS_INSTALL_DISPENSADO = "gestacad_install_dispensado";

export type AcessoLembrado = { slug: string; token: string };

/** Grava o acesso do aluno neste aparelho (para o app reabrir na área dele). */
export function lembrarAcesso(a: AcessoLembrado): void {
  try {
    if (typeof window === "undefined") return;
    if (!a.slug || !a.token) return;
    localStorage.setItem(LS_ACESSO_ALUNO, JSON.stringify(a));
  } catch {
    // Modo privado / storage cheio: ignora — o link do WhatsApp continua valendo.
  }
}

/** Lê o acesso lembrado, ou null se não houver / for inválido. */
export function lerAcessoLembrado(): AcessoLembrado | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(LS_ACESSO_ALUNO);
    if (!raw) return null;
    const v = JSON.parse(raw) as AcessoLembrado;
    if (v && typeof v.slug === "string" && typeof v.token === "string" && v.slug && v.token) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

/** Esquece o acesso neste aparelho ("sair deste dispositivo"). */
export function esquecerAcesso(): void {
  try {
    if (typeof window !== "undefined") localStorage.removeItem(LS_ACESSO_ALUNO);
  } catch {
    // ignora
  }
}

/** O app está rodando instalado (standalone), não numa aba do navegador? */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const mm = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS usa navigator.standalone (fora do padrão), não display-mode.
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean })
    ?.standalone;
  return Boolean(mm || iosStandalone);
}

/** É um aparelho Android? (para o fallback manual de instalação no Chrome). */
export function ehAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/.test(window.navigator.userAgent || "");
}

/** É um iPhone/iPad? (para mostrar o passo a passo de instalação do iOS). */
export function ehIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const iOSClassico = /iPad|iPhone|iPod/.test(ua);
  // iPadOS recente se apresenta como Mac com toque.
  const iPadOS = /Macintosh/.test(ua) && "ontouchend" in window;
  return iOSClassico || iPadOS;
}
