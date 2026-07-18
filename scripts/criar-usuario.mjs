#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Cria um novo usuário da equipe (recepção, instrutor, gerente...) e o vincula
// a uma academia existente, com um papel.
//
// Uso:
//   npm run criar-usuario -- \
//     --slug academiax \
//     --email recepcao@academiax.com \
//     --senha "senhaForte123" \
//     --nome "Maria Recepção" \
//     --papel recepcao        # dono | gerente | recepcao | instrutor
//
// Requer no ambiente (.env.local ou variáveis exportadas):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// -----------------------------------------------------------------------------

import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const PAPEIS = ["dono", "gerente", "recepcao", "instrutor"];

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
    const valor = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "";
    out[chave] = valor;
  }
  return out;
}

async function main() {
  carregarEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const slug = args["slug"];
  const email = args["email"];
  const senha = args["senha"];
  const nome = args["nome"] || email;
  const papel = args["papel"] || "recepcao";

  const faltando = ["slug", "email", "senha"].filter((k) => !args[k]);
  if (faltando.length) {
    console.error(
      `\n❌ Parâmetros obrigatórios ausentes: ${faltando.join(", ")}\n\n` +
        "Uso:\n" +
        '  npm run criar-usuario -- --slug academiax --email recepcao@academiax.com ' +
        '--senha "senha123" --nome "Maria" --papel recepcao\n'
    );
    process.exit(1);
  }
  if (!PAPEIS.includes(papel)) {
    console.error(`\n❌ Papel inválido: ${papel}. Use um de: ${PAPEIS.join(", ")}\n`);
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "\n❌ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: academia, error: erroAc } = await supabase
    .from("academias")
    .select("id, nome_fantasia")
    .eq("slug_url", slug)
    .maybeSingle();
  if (erroAc || !academia) {
    console.error(`\n❌ Academia com slug "${slug}" não encontrada.\n`);
    process.exit(1);
  }

  console.log(`\n▶ Criando login (${email}) para ${academia.nome_fantasia}...`);
  const { data: usuario, error: erroUsuario } =
    await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome },
    });
  if (erroUsuario || !usuario?.user) {
    console.error(`\n❌ Falha ao criar o usuário: ${erroUsuario?.message ?? "?"}`);
    process.exit(1);
  }

  const { error: erroPerfil } = await supabase.from("perfis_admin").insert({
    id: usuario.user.id,
    academia_id: academia.id,
    nome,
    email,
    papel,
  });
  if (erroPerfil) {
    console.error(`\n❌ Falha ao vincular o perfil: ${erroPerfil.message}`);
    await supabase.auth.admin.deleteUser(usuario.user.id);
    process.exit(1);
  }

  console.log("\n✅ Usuário criado com sucesso!\n");
  console.log(`   Nome:   ${nome}`);
  console.log(`   Login:  ${email}`);
  console.log(`   Papel:  ${papel}`);
  console.log(`   Painel: /painel/${slug}\n`);
}

main().catch((err) => {
  console.error("\n❌ Erro inesperado:", err);
  process.exit(1);
});
