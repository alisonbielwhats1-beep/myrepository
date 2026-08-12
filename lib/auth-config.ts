// Configuração de MÉTODOS de autenticação disponíveis por ambiente.
//
// Regra do prompt (7.4, 13, 17): NUNCA exibir um botão social que ainda não
// tenha configuração válida no ambiente — um botão que leva a erro é pior que
// nenhum botão. Cada provedor social é ligado por uma flag explícita, que o
// responsável só ativa DEPOIS de configurar o provedor no Supabase e no
// console (Google/Apple). Sem a flag, o botão não é renderizado.
//
// Estas flags são `NEXT_PUBLIC_*` porque a decisão de MOSTRAR o botão acontece
// no cliente. Elas NÃO são segredo: o segredo (client secret / chave Apple)
// mora só no Supabase, no servidor, por ambiente. A flag apenas diz "este
// caminho está operacional aqui".

/** Google OAuth operacional neste ambiente? Ative só após configurar tudo. */
export const GOOGLE_HABILITADO =
  process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1" ||
  process.env.NEXT_PUBLIC_AUTH_GOOGLE === "true";

/** Apple OAuth operacional neste ambiente? Ative só após configurar tudo. */
export const APPLE_HABILITADO =
  process.env.NEXT_PUBLIC_AUTH_APPLE === "1" ||
  process.env.NEXT_PUBLIC_AUTH_APPLE === "true";

/** Algum login social disponível? (para decidir se mostra o divisor "ou"). */
export const TEM_LOGIN_SOCIAL = GOOGLE_HABILITADO || APPLE_HABILITADO;

export type ProvedorSocial = "google" | "apple";

/** Lista dos provedores realmente habilitados, na ordem de exibição. */
export function provedoresHabilitados(): ProvedorSocial[] {
  const lista: ProvedorSocial[] = [];
  // Google primeiro: caminho de menor atrito (prompt 13).
  if (GOOGLE_HABILITADO) lista.push("google");
  if (APPLE_HABILITADO) lista.push("apple");
  return lista;
}

/** Um provedor específico está habilitado? Defesa no servidor antes do OAuth. */
export function provedorHabilitado(p: ProvedorSocial): boolean {
  return p === "google" ? GOOGLE_HABILITADO : APPLE_HABILITADO;
}
