/**
 * Origem pública canônica para links compartilhados (QR de treino/feedback,
 * link do app do aluno, webhooks).
 *
 * PROBLEMA que resolve: usar `window.location.origin` fazia o QR apontar para
 * a URL exata pela qual o dono abriu o painel — que na Vercel pode ser uma URL
 * de deploy/preview efêmera (ex.: ...-git-branch.vercel.app). Quando esse
 * deploy some, o QR passa a cair numa página de erro da Vercel.
 *
 * SOLUÇÃO: se `NEXT_PUBLIC_SITE_URL` estiver definida (domínio de produção
 * fixo), usa sempre ela. Sem a variável, cai no comportamento antigo
 * (origem atual), que continua funcionando em produção estável e local.
 */
export function origemPublica(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}
