/**
 * Testes de lib/erros-amigaveis.ts (mensagens de erro para o cliente —
 * 2026-08-11).
 *
 * Roda com: npm run test:erros
 *
 * As mensagens usadas aqui são textos REAIS do Postgres/PostgREST, copiados do
 * formato que o supabase-js devolve — inclusive o erro de auditoria que o
 * cliente viu em produção em 11/08/2026 ("Could not find the table
 * 'public.logs_auditoria' in the schema cache").
 *
 * Além da tradução em si, dois testes travam as garantias do módulo: nenhuma
 * mensagem devolvida pode conter jargão técnico, e o campo `details` (que
 * carrega o valor em conflito, como o CPF de outra pessoa) nunca pode vazar.
 */
import { traduzirErro } from "../.test-build-erros/erros-amigaveis.js";

let passou = 0;
let falhou = 0;
function check(nome, cond, detalhe = "") {
  if (cond) {
    passou++;
    console.log(`  OK   ${nome}`);
  } else {
    falhou++;
    console.log(`  FALHA ${nome} ${detalhe}`);
  }
}
function contem(nome, obtido, esperado) {
  check(nome, obtido.includes(esperado), `-> "${obtido}"`);
}

console.log("\n1. Tabela ausente — o erro que o cliente viu em produção");
{
  const erro = {
    code: "PGRST205",
    message: "Could not find the table 'public.logs_auditoria' in the schema cache",
  };
  const msg = traduzirErro(erro, "registrar a auditoria");
  contem("explica sem jargão", msg, "ainda não foi ativado no banco de dados");
  contem("tranquiliza sobre o resto do sistema", msg, "continua funcionando");
  contem("direciona para o suporte", msg, "suporte");
  check("não manda o usuário tentar de novo à toa", !msg.includes("Tente novamente"), `-> ${msg}`);
}

console.log("\n2. CPF duplicado — o caso mais comum da recepção");
{
  const erro = {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "alunos_academia_id_cpf_key"',
    details: "Key (academia_id, cpf)=(232cae9b-4800-46de-a5a5-d323f846e04d, 12345678901) already exists.",
  };
  const msg = traduzirErro(erro, "cadastrar o aluno");
  check("diz exatamente qual é o conflito", msg === "Já existe um aluno cadastrado com este CPF nesta academia.", `-> ${msg}`);
  check("NÃO vaza o CPF do details", !msg.includes("12345678901"), `-> ${msg}`);
  check("NÃO vaza o id da academia", !msg.includes("232cae9b"), `-> ${msg}`);
}

console.log("\n3. Outros conflitos de unicidade");
{
  check(
    "funcionário com CPF repetido",
    traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "funcionarios_academia_id_cpf_key"' }, "cadastrar o funcionário") ===
      "Já existe um funcionário cadastrado com este CPF."
  );
  check(
    "mensalidade repetida no mês",
    traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "uidx_mensalidade_aluno_comp"' }, "lançar a mensalidade") ===
      "Já existe uma mensalidade lançada para este aluno neste mês."
  );
  check(
    "folha de salário repetida",
    traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "uidx_despesa_salario_unica"' }, "gerar a folha") ===
      "A folha deste funcionário já foi lançada neste mês."
  );
  contem(
    "unicidade desconhecida cai num genérico compreensível",
    traduzirErro({ code: "23505", message: 'duplicate key value violates unique constraint "uidx_qualquer_coisa_nova"' }, "salvar"),
    "já existe"
  );
}

console.log("\n4. Permissão (RLS) — o erro mais assustador da tela");
{
  const msg = traduzirErro(
    { code: "42501", message: 'new row violates row-level security policy for table "alunos"' },
    "cadastrar o aluno"
  );
  contem("fala de permissão, não de policy", msg, "não tem permissão");
  contem("diz o que fazer", msg, "dono");
  check("não menciona RLS nem tabela", !/row-level|policy|table/i.test(msg), `-> ${msg}`);
}

console.log("\n5. Vínculo entre registros — excluir x selecionar");
{
  contem(
    "excluir algo em uso",
    traduzirErro({ code: "23503", message: 'update or delete on table "planos" violates foreign key constraint on table "alunos" — Key is still referenced from table "alunos".' }, "excluir o plano"),
    "está sendo usado"
  );
  contem(
    "selecionar algo que sumiu",
    traduzirErro({ code: "23503", message: 'insert on table "alunos" violates foreign key constraint "alunos_plano_id_fkey" — Key (plano_id)=(abc) is not present in table "planos".' }, "cadastrar o aluno"),
    "não existe mais"
  );
}

console.log("\n6. Campos: obrigatório, formato, tamanho e regra de negócio");
{
  contem("not null", traduzirErro({ code: "23502", message: 'null value in column "nome" violates not-null constraint' }, "salvar"), "campo obrigatório");
  contem("formato inválido", traduzirErro({ code: "22P02", message: 'invalid input syntax for type integer: "abc"' }, "salvar"), "formato inválido");
  contem("texto longo demais", traduzirErro({ code: "22001", message: "value too long for type character varying(120)" }, "salvar"), "tamanho permitido");
  check(
    "valor negativo",
    traduzirErro({ code: "23514", message: 'new row violates check constraint "receitas_valor_nao_negativo"' }, "lançar a receita") ===
      "O valor não pode ser negativo."
  );
  check(
    "mensagem vazia",
    traduzirErro({ code: "23514", message: 'new row violates check constraint "atendimento_mensagens_nao_vazia"' }, "responder") ===
      "Escreva a mensagem antes de enviar."
  );
}

console.log("\n7. Sessão, rede e banco ocupado");
{
  contem("sessão expirada", traduzirErro({ code: "PGRST301", message: "JWT expired" }, "salvar"), "sessão expirou");
  contem("sem rede", traduzirErro({ message: "TypeError: fetch failed" }, "salvar"), "conexão com a internet");
  contem("timeout", traduzirErro({ code: "57014", message: "canceling statement due to statement timeout" }, "carregar"), "ocupado");
  contem("registro sumiu", traduzirErro({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, "abrir"), "não encontrado");
}

console.log("\n8. Supabase Auth (mensagens em inglês)");
{
  check("credenciais", traduzirErro({ message: "Invalid login credentials" }, "entrar") === "E-mail ou senha incorretos.");
  check("senha curta", traduzirErro({ message: "Password should be at least 6 characters" }, "redefinir a senha") === "A senha é curta demais — use pelo menos 6 caracteres.");
  check("senha repetida", traduzirErro({ message: "New password should be different from the old password." }, "redefinir a senha") === "A nova senha precisa ser diferente da anterior.");
  check("e-mail já usado", traduzirErro({ message: "User already registered" }, "convidar") === "Este e-mail já está cadastrado.");
}

console.log("\n9. Erro desconhecido — nunca fica sem resposta útil");
{
  const msg = traduzirErro({ code: "XX000", message: "internal error: pg_stat something exploded" }, "salvar o plano");
  contem("diz o que falhou, em português", msg, "Não foi possível salvar o plano");
  contem("dá um código para o suporte", msg, "XX000");
  check("não repete o texto técnico", !msg.includes("pg_stat"), `-> ${msg}`);

  const semNada = traduzirErro(null, "salvar");
  check("erro nulo ainda devolve frase", semNada.length > 0 && semNada.startsWith("Não foi possível"), `-> ${semNada}`);
  const semCodigo = traduzirErro({ message: "algo estranho" }, "salvar");
  check("sem código não escreve 'código undefined'", !semCodigo.includes("undefined"), `-> ${semCodigo}`);
}

console.log("\n10. Garantia geral — nenhuma mensagem devolve jargão");
{
  const casos = [
    { code: "PGRST205", message: "Could not find the table 'public.logs_auditoria' in the schema cache" },
    { code: "23505", message: 'duplicate key value violates unique constraint "alunos_academia_id_cpf_key"' },
    { code: "42501", message: "new row violates row-level security policy" },
    { code: "23503", message: "violates foreign key constraint — is still referenced from table" },
    { code: "23502", message: "null value in column violates not-null constraint" },
    { code: "23514", message: 'violates check constraint "receitas_valor_nao_negativo"' },
    { code: "22P02", message: "invalid input syntax for type uuid" },
    { code: "57014", message: "canceling statement due to statement timeout" },
    { message: "fetch failed" },
    null,
  ];
  const jargao = /constraint|schema cache|null value|foreign key|row-level|violates|duplicate key|statement|invalid input|uuid|postgres/i;
  const vazando = casos
    .map((c) => traduzirErro(c, "salvar"))
    .filter((m) => jargao.test(m));
  check("nenhum caso vaza termo técnico", vazando.length === 0, `-> ${vazando.join(" | ")}`);

  const semPonto = casos.map((c) => traduzirErro(c, "salvar")).filter((m) => !m.trim().endsWith("."));
  check("toda mensagem é uma frase terminada em ponto", semPonto.length === 0, `-> ${semPonto.join(" | ")}`);
}

console.log(`\n=== ${passou} passaram, ${falhou} falharam ===`);
process.exit(falhou > 0 ? 1 : 0);
