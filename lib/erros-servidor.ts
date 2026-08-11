// Ponte entre a tradução de erro (pura) e o mundo com I/O: log do servidor e
// registro em banco. Server-only — usa os clients do Supabase.
//
// A regra de negócio de "qual frase o usuário lê" mora em lib/erros-amigaveis.ts,
// que é puro e testado isolado (`npm run test:erros`). Aqui só acontece o que
// depende de infraestrutura, e é por isso que os dois arquivos são separados:
// misturar os dois tornaria a tradução impossível de testar sem banco.

import { createClient, createServiceRoleClient } from "./supabase/server";
import { traduzirErro, type ErroTecnico } from "./erros-amigaveis";

/**
 * Descobre em nome de quem o erro aconteceu.
 *
 * Roda no caminho de exceção, nunca no caminho feliz — o custo das duas
 * consultas só é pago quando algo já falhou. Devolve tudo nulo se não der
 * para identificar: um erro sem autor conhecido continua valendo mais
 * registrado do que descartado.
 */
async function identificarAutor(): Promise<{
  academiaId: string | null;
  academiaNome: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
}> {
  const vazio = {
    academiaId: null,
    academiaNome: null,
    usuarioId: null,
    usuarioNome: null,
  };

  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    if (!user) return vazio;

    // Service role: o perfil é lido mesmo que o erro original tenha sido uma
    // falha de RLS na sessão do usuário.
    const { data: perfil } = await createServiceRoleClient()
      .from("perfis_admin")
      .select("nome, academia_id, academias(nome_fantasia)")
      .eq("id", user.id)
      .maybeSingle();

    const academia = perfil?.academias as { nome_fantasia?: string } | null;

    return {
      academiaId: (perfil?.academia_id as string) ?? null,
      academiaNome: academia?.nome_fantasia ?? null,
      usuarioId: user.id,
      usuarioNome: (perfil?.nome as string) ?? user.email ?? null,
    };
  } catch {
    return vazio;
  }
}

/**
 * Grava o erro em `logs_erros` (migration 061) para a tela /admin/atividade.
 *
 * NUNCA lança e nunca propaga falha: a operação de negócio já terminou quando
 * isto roda, e não conseguir registrar o erro não pode virar um segundo erro
 * na cara do usuário. Falha de registro vai para o console — nunca um catch
 * vazio. Mesma disciplina de lib/auditoria.ts.
 *
 * O campo `details` do Postgres fica de fora de propósito: ele contém o valor
 * que causou o conflito (o CPF de outra pessoa, por exemplo).
 */
async function registrarErro(
  erro: ErroTecnico,
  acao: string,
  mensagemUsuario: string
): Promise<void> {
  try {
    const autor = await identificarAutor();

    const { error } = await createServiceRoleClient().from("logs_erros").insert({
      academia_id: autor.academiaId,
      academia_nome: autor.academiaNome,
      usuario_id: autor.usuarioId,
      usuario_nome: autor.usuarioNome,
      acao,
      codigo: erro?.code ?? null,
      mensagem_tecnica: erro?.message ?? null,
      mensagem_usuario: mensagemUsuario,
    });

    if (error) {
      console.error(
        `[logs_erros] falha ao registrar o erro de "${acao}": ${error.message}`
      );
    }
  } catch (excecao) {
    console.error(`[logs_erros] exceção ao registrar o erro de "${acao}":`, excecao);
  }
}

/**
 * Traduz o erro para o usuário, registra o original no log do servidor e o
 * arquiva em `logs_erros`.
 *
 * `acao` é o que o usuário estava tentando fazer, em infinitivo e com artigo:
 * "cadastrar o aluno", "lançar a despesa". Aparece na frase genérica quando o
 * erro não é reconhecido e é o que dá sentido à listagem em /admin/atividade.
 *
 * Uso: `return { erro: await erroAmigavel(error, "cadastrar o aluno") };`
 */
export async function erroAmigavel(
  erro: ErroTecnico,
  acao: string
): Promise<string> {
  const mensagemUsuario = traduzirErro(erro, acao);

  // Log técnico completo — é o que mantém a depuração pela Vercel igual ao que
  // era antes desta camada existir. Aqui `details` e `hint` entram: o log do
  // servidor é interno, ao contrário da tela e da tabela.
  console.error(
    `[erro] ao ${acao}:`,
    JSON.stringify({
      code: erro?.code ?? null,
      message: erro?.message ?? null,
      details: erro?.details ?? null,
      hint: erro?.hint ?? null,
    })
  );

  await registrarErro(erro, acao, mensagemUsuario);

  return mensagemUsuario;
}
