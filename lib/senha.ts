// Regras de senha — puras, sem I/O, compartilhadas pelos dois fluxos de troca.
//
// Ficam separadas das Server Actions (lib/actions/auth.ts) porque a Action
// depende do Supabase e não é testável sem banco. Isto aqui é lógica pura:
// compila e roda isolado por `npm run test:senha`. Assim as regras que o
// cliente realmente encosta — tamanho mínimo, confirmação, "diferente da
// atual" — ficam cobertas sem mock nenhum.

/** Mínimo aceito pelo Supabase Auth do projeto. Um número só, num lugar só. */
export const SENHA_MIN = 8;

/**
 * Regras da REDEFINIÇÃO (fluxo "Esqueci minha senha"): a autorização é o link
 * do e-mail, então não há senha atual para comparar.
 * Retorna a mensagem de erro, ou null se estiver tudo certo.
 */
export function validarNovaSenha(
  nova: string,
  confirmar: string
): string | null {
  if (nova.length < SENHA_MIN) {
    return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (nova !== confirmar) {
    return "As senhas não coincidem.";
  }
  return null;
}

/**
 * Regras da ALTERAÇÃO com o usuário logado ("Minha conta"): exige a senha atual
 * e proíbe repetir a mesma. A conferência de que a senha atual está CORRETA é
 * feita no servidor (reautenticação) — aqui só validamos o formato.
 */
export function validarAlteracaoSenha(
  atual: string,
  nova: string,
  confirmar: string
): string | null {
  if (!atual) return "Informe a senha atual.";
  if (nova.length < SENHA_MIN) {
    return `A nova senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  }
  if (nova !== confirmar) {
    return "A confirmação não coincide com a nova senha.";
  }
  if (nova === atual) {
    return "A nova senha precisa ser diferente da atual.";
  }
  return null;
}
