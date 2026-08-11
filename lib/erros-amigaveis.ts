// Tradução de erro técnico para frase que a recepção entende.
//
// POR QUE ESTE MÓDULO EXISTE
//   Até 2026-08-11 as Server Actions devolviam o texto cru do Postgres direto
//   na tela do cliente — coisas como `duplicate key value violates unique
//   constraint "alunos_academia_id_cpf_key"`. Quem está na recepção com um
//   aluno esperando não tem como agir sobre isso; a frase útil é "já existe um
//   aluno com este CPF".
//
// DUAS REGRAS QUE NÃO PODEM SER QUEBRADAS
//   1. O detalhe técnico NUNCA some: `erroAmigavel` grava a mensagem original
//      no log do servidor (visível na Vercel) antes de devolver a versão
//      amigável. Depurar continua igual ao que era.
//   2. O campo `details` do Postgres NUNCA vai para a tela. Ele carrega o valor
//      que causou o conflito — `Key (academia_id, cpf)=(..., 12345678901)
//      already exists` expõe o CPF de outra pessoa para quem estiver olhando a
//      tela.
//
// PURO (sem I/O, sem React/Next/Supabase): `traduzirErro` compila isolado pelo
// `npm run test:erros`, no mesmo padrão de lib/normalizacao.ts.

/** Formato de erro do supabase-js/PostgREST (e de um Error comum). */
export type ErroTecnico =
  | {
      code?: string | null;
      message?: string | null;
      details?: string | null;
      hint?: string | null;
    }
  | null
  | undefined;

/**
 * Conflitos de unicidade, por nome do índice/constraint que apareceu na
 * mensagem do Postgres. A chave é um trecho procurado dentro do texto — os
 * índices explícitos do projeto (`uidx_*`) e os nomes automáticos que o
 * Postgres dá a um `unique (a, b)` declarado sem nome (`tabela_col_col_key`).
 */
const DUPLICIDADES: [trecho: string, mensagem: string][] = [
  ["alunos_academia_id_cpf_key", "Já existe um aluno cadastrado com este CPF nesta academia."],
  ["funcionarios_academia_id_cpf_key", "Já existe um funcionário cadastrado com este CPF."],
  ["uidx_alunos_chave_idempotencia", "Este cadastro já foi salvo. Atualize a lista para vê-lo."],
  ["uidx_mensalidade_aluno_comp", "Já existe uma mensalidade lançada para este aluno neste mês."],
  ["uidx_despesa_salario_unica", "A folha deste funcionário já foi lançada neste mês."],
  ["uidx_acessos_chave_idempotencia", "Esta entrada já foi registrada."],
  ["uidx_acessos_evento_externo", "Esta entrada já foi registrada."],
  ["uidx_sessoes_treino_ativa_unica", "Este aluno já tem um treino em andamento."],
  ["dedupe_key", "Este aviso já foi enviado."],
  ["plataforma", "Já existe uma configuração para esta plataforma."],
];

/**
 * Regras de negócio do banco (CHECK) que o usuário consegue corrigir sozinho.
 * Mesma ideia: casa por trecho do nome da constraint.
 */
const REGRAS_CHECK: [trecho: string, mensagem: string][] = [
  ["valor_nao_negativo", "O valor não pode ser negativo."],
  ["preco_nao_negativo", "O preço não pode ser negativo."],
  ["min_nao_negativo", "A quantidade não pode ser negativa."],
  ["nao_vazio", "Preencha este campo antes de salvar."],
  ["nao_vazia", "Escreva a mensagem antes de enviar."],
  ["papel_check", "O perfil de acesso escolhido não é válido."],
  ["categoria_valida", "A categoria escolhida não é válida."],
  ["status_valido", "O status escolhido não é válido."],
];

/**
 * Erros do Supabase Auth — chegam em inglês, direto do serviço, e não têm
 * código do Postgres. Casados por trecho da mensagem, em minúsculas.
 */
const ERROS_AUTENTICACAO: [trecho: string, mensagem: string][] = [
  ["invalid login credentials", "E-mail ou senha incorretos."],
  ["email not confirmed", "Este e-mail ainda não foi confirmado. Verifique a caixa de entrada."],
  ["user already registered", "Este e-mail já está cadastrado."],
  ["already been registered", "Este e-mail já está cadastrado."],
  ["should be at least", "A senha é curta demais — use pelo menos 6 caracteres."],
  ["should be different from the old password", "A nova senha precisa ser diferente da anterior."],
  ["for security purposes", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
  ["rate limit", "Muitas tentativas seguidas. Aguarde um minuto e tente de novo."],
  ["token has expired", "Este link expirou. Peça um novo."],
  ["invalid or has expired", "Este link expirou. Peça um novo."],
];

function procurar(
  tabela: [string, string][],
  texto: string
): string | null {
  const alvo = texto.toLowerCase();
  for (const [trecho, mensagem] of tabela) {
    if (alvo.includes(trecho)) return mensagem;
  }
  return null;
}

/**
 * Traduz um erro técnico para uma frase acionável em português.
 *
 * `acao` descreve o que o usuário estava tentando fazer, em infinitivo e com
 * artigo — "cadastrar o aluno", "lançar a despesa". Entra na frase final
 * quando o erro não é reconhecido, para que a mensagem genérica ainda diga a
 * QUE ela se refere.
 *
 * Nunca devolve string vazia: se não reconhecer nada, monta uma frase genérica
 * com o código técnico no fim — é o que o cliente repete para o suporte.
 */
export function traduzirErro(erro: ErroTecnico, acao: string): string {
  const codigo = String(erro?.code ?? "").trim();
  const mensagem = String(erro?.message ?? "");
  const texto = mensagem.toLowerCase();

  // --- Estrutura ausente no banco -----------------------------------------
  // PGRST205/42P01 (tabela) e PGRST204/42703 (coluna): o código do app espera
  // algo que este banco ainda não tem — migration não aplicada. Não é erro do
  // usuário e não adianta ele tentar de novo, então a frase manda avisar o
  // suporte em vez de sugerir nova tentativa.
  if (
    codigo === "PGRST205" ||
    codigo === "PGRST204" ||
    codigo === "42P01" ||
    codigo === "42703" ||
    texto.includes("schema cache")
  ) {
    return (
      "Este recurso ainda não foi ativado no banco de dados desta academia. " +
      "O restante do sistema continua funcionando normalmente — avise o suporte para concluir a atualização."
    );
  }

  // --- Permissão ------------------------------------------------------------
  if (
    codigo === "42501" ||
    texto.includes("row-level security") ||
    texto.includes("permission denied")
  ) {
    return "Você não tem permissão para fazer isso nesta academia. Fale com o dono para liberar o acesso.";
  }

  // --- Sessão ---------------------------------------------------------------
  if (codigo === "PGRST301" || texto.includes("jwt expired")) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  // --- Duplicidade ----------------------------------------------------------
  if (codigo === "23505" || texto.includes("duplicate key")) {
    return (
      procurar(DUPLICIDADES, mensagem) ??
      "Este registro já existe — verifique se ele não foi salvo duas vezes."
    );
  }

  // --- Vínculo entre registros ---------------------------------------------
  if (codigo === "23503" || texto.includes("foreign key")) {
    // "is still referenced from table" = tentou excluir algo em uso;
    // "is not present in table" = escolheu algo que não existe (mais). Dois
    // problemas opostos, duas saídas opostas para o usuário.
    if (texto.includes("still referenced")) {
      return "Este item está sendo usado em outros registros e não pode ser excluído. Remova ou transfira os registros ligados a ele primeiro.";
    }
    return "O item selecionado não existe mais. Atualize a página e escolha novamente.";
  }

  // --- Campo obrigatório ----------------------------------------------------
  if (codigo === "23502" || texto.includes("not-null constraint")) {
    return "Faltou preencher um campo obrigatório.";
  }

  // --- Regra de negócio do banco -------------------------------------------
  if (codigo === "23514" || texto.includes("check constraint")) {
    return (
      procurar(REGRAS_CHECK, mensagem) ??
      "Um dos valores informados não é aceito pelo sistema. Revise os campos e tente de novo."
    );
  }

  // --- Formato / tamanho ----------------------------------------------------
  if (codigo === "22P02" || texto.includes("invalid input syntax")) {
    return "Um dos campos está em formato inválido — confira números, datas e valores.";
  }
  if (codigo === "22001" || texto.includes("value too long")) {
    return "Um dos campos passou do tamanho permitido. Escreva de forma mais curta.";
  }
  if (codigo === "22003" || codigo === "22007" || codigo === "22008") {
    return "Um dos valores informados está fora do intervalo aceito.";
  }

  // --- Nada encontrado ------------------------------------------------------
  if (codigo === "PGRST116") {
    return "Registro não encontrado. Ele pode ter sido excluído por outra pessoa — atualize a página.";
  }

  // --- Banco ocupado / tempo esgotado --------------------------------------
  if (
    codigo === "40001" ||
    codigo === "40P01" ||
    codigo === "55P03" ||
    codigo === "57014" ||
    texto.includes("timeout") ||
    texto.includes("deadlock")
  ) {
    return "O sistema estava ocupado e não concluiu a operação. Aguarde alguns segundos e tente de novo.";
  }

  // --- Rede -----------------------------------------------------------------
  if (
    texto.includes("fetch failed") ||
    texto.includes("network") ||
    texto.includes("econnrefused") ||
    texto.includes("enotfound")
  ) {
    return "Não conseguimos falar com o servidor. Verifique a conexão com a internet e tente de novo.";
  }

  // --- Autenticação ---------------------------------------------------------
  const autenticacao = procurar(ERROS_AUTENTICACAO, mensagem);
  if (autenticacao) return autenticacao;

  // --- Desconhecido ---------------------------------------------------------
  // O código técnico entra no fim (quando existe) porque é curto, não expõe
  // dado de ninguém e é o que torna o chamado ao suporte resolvível.
  const referencia = codigo ? ` (código ${codigo})` : "";
  return `Não foi possível ${acao}. Tente novamente em alguns instantes; se continuar, avise o suporte${referencia}.`;
}

/**
 * Versão para as Server Actions: registra o erro técnico completo no log do
 * servidor e devolve a mensagem amigável para a tela.
 *
 * O `console.error` é o que mantém a depuração pela Vercel exatamente como era
 * antes desta mudança — o texto do Postgres continua inteiro no log, com
 * `details` e `hint`; o que muda é só o que o cliente lê.
 */
export function erroAmigavel(erro: ErroTecnico, acao: string): string {
  console.error(
    `[erro] ao ${acao}:`,
    JSON.stringify({
      code: erro?.code ?? null,
      message: erro?.message ?? null,
      details: erro?.details ?? null,
      hint: erro?.hint ?? null,
    })
  );
  return traduzirErro(erro, acao);
}
