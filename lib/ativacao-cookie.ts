// Constantes do cookie de contexto do convite. Ficam FORA do módulo
// "use server" (lib/actions/ativacao.ts) porque um arquivo "use server" só
// pode exportar funções assíncronas — não constantes. Route Handlers e Server
// Components importam o nome do cookie daqui.

/** Cookie que carrega o token do convite através de OAuth/confirmação. */
export const COOKIE_CONVITE = "gestacad_convite";

/** Tempo de vida do cookie (segundos). Curto por design. */
export const COOKIE_CONVITE_MAX_AGE = 60 * 30; // 30 min
