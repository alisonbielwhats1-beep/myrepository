#!/usr/bin/env node
// -----------------------------------------------------------------------------
// seed-demo.mjs — Semente de dados de demonstração para um tenant explícito.
//
// NUNCA execute sem os flags obrigatórios. Este script NÃO modifica nenhuma
// academia automaticamente — exige que o operador identifique o tenant de
// demonstração pelo slug e confirme a intenção.
//
// Uso:
//   node scripts/seed-demo.mjs --slug <slug-da-academia-demo> --confirmar
//
// O script:
//   1. Verifica que a academia com o slug informado existe no banco.
//   2. REJEITA se a academia possui alunos sem prefixo DEMO- (dados reais).
//   3. REJEITA se já existem dados de demonstração (idempotência).
//   4. Lê supabase/migrations/004_dados_demo.sql e substitui o slug.
//   5. Imprime o SQL completo no terminal para execução manual no SQL Editor.
//
// O script não executa SQL diretamente — a execução permanece manual e
// auditável no Supabase SQL Editor.
//
// Requer no ambiente (.env.local ou variáveis exportadas):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function carregarEnvLocal() {
  const caminho = new URL("../.env.local", import.meta.url);
  if (!existsSync(caminho)) return;
  const conteudo = readFileSync(caminho, "utf8");
  for (const linha of conteudo.split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const igual = l.indexOf("=");
    if (igual === -1) continue;
    const chave = l.slice(0, igual).trim();
    let valor = l.slice(igual + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const chave = a.slice(2);
    const proximo = argv[i + 1];
    const valor = proximo && !proximo.startsWith("--") ? argv[++i] : "true";
    out[chave] = valor;
  }
  return out;
}

async function main() {
  carregarEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const slug = args["slug"];
  const confirmar = "confirmar" in args;

  if (!slug) {
    console.error(
      "\n❌  O flag --slug é obrigatório.\n\n" +
        "Uso:\n" +
        "  node scripts/seed-demo.mjs --slug <slug-da-academia-demo> --confirmar\n\n" +
        "Este script insere dados FICTÍCIOS de demonstração.\n" +
        "Use somente em um tenant criado exclusivamente para demonstração.\n"
    );
    process.exit(1);
  }

  if (!confirmar) {
    console.error(
      "\n❌  Confirmação obrigatória. Adicione --confirmar ao comando.\n\n" +
        `  node scripts/seed-demo.mjs --slug ${slug} --confirmar\n\n` +
        "⚠   Este script insere dados FICTÍCIOS (alunos, receitas, despesas,\n" +
        "    acessos e treinos de demonstração). Use somente em tenants demo.\n"
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "\n❌  Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY " +
        "no .env.local antes de rodar este script.\n"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── 1. Verifica que a academia existe ──────────────────────────────────────
  const { data: academia, error: erroAc } = await supabase
    .from("academias")
    .select("id, nome_fantasia, slug_url")
    .eq("slug_url", slug)
    .maybeSingle();

  if (erroAc || !academia) {
    console.error(`\n❌  Academia com slug "${slug}" não encontrada no banco.\n`);
    process.exit(1);
  }

  // ─── 2. Rejeita se a academia tem alunos com dados reais (não-DEMO) ─────────
  const { count: alunosReais, error: erroContagem } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academia.id)
    .not("matricula_codigo", "like", "DEMO-%");

  if (erroContagem) {
    console.error(`\n❌  Falha ao verificar alunos reais: ${erroContagem.message}\n`);
    process.exit(1);
  }

  if (alunosReais && alunosReais > 0) {
    console.error(
      `\n❌  OPERAÇÃO BLOQUEADA\n\n` +
        `  Academia : ${academia.nome_fantasia}\n` +
        `  Slug     : ${slug}\n` +
        `  Motivo   : ${alunosReais} aluno(s) com matrícula não-DEMO encontrado(s).\n\n` +
        "  Este script recusa inserir dados fictícios em academias com alunos reais.\n" +
        "  Crie uma academia dedicada exclusivamente para demonstração e use o slug dela.\n"
    );
    process.exit(1);
  }

  // ─── 3. Idempotência: rejeita se dados demo já existem ──────────────────────
  const { count: alunosDemo } = await supabase
    .from("alunos")
    .select("id", { count: "exact", head: true })
    .eq("academia_id", academia.id)
    .like("matricula_codigo", "DEMO-%");

  if (alunosDemo && alunosDemo > 0) {
    console.error(
      `\n❌  A academia "${academia.nome_fantasia}" (${slug}) já possui dados de demonstração.\n\n` +
        "  Execute supabase/migrations/004b_remover_dados_demo.sql no SQL Editor\n" +
        "  para limpar os dados existentes antes de re-seed.\n"
    );
    process.exit(1);
  }

  // ─── 4. Lê a migration 004 e substitui o slug ────────────────────────────────
  const migrationPath = new URL(
    "../supabase/migrations/004_dados_demo.sql",
    import.meta.url
  );

  if (!existsSync(migrationPath)) {
    console.error(
      "\n❌  Arquivo supabase/migrations/004_dados_demo.sql não encontrado.\n"
    );
    process.exit(1);
  }

  const sqlOriginal = readFileSync(migrationPath, "utf8");

  // Substitui a linha de configuração do slug.
  //
  // BUG CORRIGIDO: a string de busca "v_slug text := null;" também aparece
  // dentro do comentário de cabeçalho do arquivo (linha ~11, explicando como
  // trocar o slug manualmente). `String.replace(string, ...)` troca só a
  // PRIMEIRA ocorrência — e essa primeira ocorrência é o comentário, não a
  // declaração real dentro do `do $$ ... declare`. O resultado era um SQL que
  // parecia correto (a verificação abaixo passava, porque *algo* foi
  // substituído) mas cujo bloco executável continuava com `v_slug := null`,
  // fazendo o script mirar "a academia mais antiga do banco inteiro" em vez
  // do slug pedido — silenciosamente, sem erro nenhum.
  //
  // Correção: ancorar a busca no trecho que só existe no código real
  // (a linha seguinte, `v_academia_id uuid;`, não existe dentro do
  // comentário), garantindo que a única ocorrência possível é a declaração.
  // O arquivo usa quebra de linha CRLF (\r\n) — a âncora precisa do \r para
  // casar com o texto real (confirmado byte a byte; \n sozinho não casava).
  const slugEscapado = slug.replace(/'/g, "''");
  const anchorOriginal = "v_slug text := null;\r\n  v_academia_id uuid;";
  const anchorModificado = `v_slug text := '${slugEscapado}';\r\n  v_academia_id uuid;`;
  const sqlModificado = sqlOriginal.replace(anchorOriginal, anchorModificado);

  if (sqlModificado === sqlOriginal) {
    console.error(
      "\n❌  Não foi possível localizar a linha de configuração do slug em\n" +
        "  004_dados_demo.sql. O arquivo pode ter sido modificado.\n" +
        "  Verifique manualmente o bloco: declare / v_slug text := null; / v_academia_id uuid;\n"
    );
    process.exit(1);
  }

  // ─── 5. Exibe o SQL pronto para execução manual ──────────────────────────────
  const linha = "═".repeat(72);
  const separador = "─".repeat(72);

  console.log("\n" + linha);
  console.log(" GESTACAD — SEED DE DEMONSTRAÇÃO");
  console.log(linha);
  console.log(`\n  Academia  : ${academia.nome_fantasia}`);
  console.log(`  Slug      : ${slug}`);
  console.log(`  ID        : ${academia.id}`);
  console.log(
    "\n  ⚠   O SQL abaixo insere dados FICTÍCIOS de demonstração.\n" +
      "      Copie-o e execute no Supabase SQL Editor deste projeto.\n" +
      "      Não execute em produção nem em academias com alunos reais.\n"
  );
  console.log(separador + "\n");
  console.log(sqlModificado);
  console.log("\n" + separador);
  console.log(
    "\n  Copie o SQL acima e cole no Supabase SQL Editor.\n" +
      "  Para remover esses dados depois: 004b_remover_dados_demo.sql\n"
  );
  console.log(linha + "\n");
}

main().catch((err) => {
  console.error("\n❌  Erro inesperado:", err);
  process.exit(1);
});
