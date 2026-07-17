#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Provisiona uma nova academia (tenant) + o primeiro usuário administrador.
//
// Uso:
//   npm run criar-academia -- \
//     --nome "IronPulse Academia" \
//     --slug ironpulse \
//     --email admin@ironpulse.com \
//     --senha "umaSenhaForte123" \
//     --admin-nome "Fulano de Tal" \
//     --endereco "Av. Paulista, 1000 - São Paulo/SP" \
//     --telefone "(11) 99999-0000"
//
// Requer no ambiente (.env.local ou variáveis exportadas):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (NUNCA exponha essa chave no client)
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
    const valor = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "";
    out[chave] = valor;
  }
  return out;
}

async function main() {
  carregarEnvLocal();

  const args = parseArgs(process.argv.slice(2));
  const nome = args["nome"];
  const slug = args["slug"];
  const email = args["email"];
  const senha = args["senha"];
  const adminNome = args["admin-nome"] || nome;
  const endereco = args["endereco"] || null;
  const telefone = args["telefone"] || null;

  const faltando = ["nome", "slug", "email", "senha"].filter((k) => !args[k]);
  if (faltando.length) {
    console.error(
      `\n❌ Parâmetros obrigatórios ausentes: ${faltando.join(", ")}\n\n` +
        "Uso:\n" +
        '  npm run criar-academia -- --nome "Academia X" --slug academiax ' +
        '--email admin@academiax.com --senha "senhaForte123"\n'
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      "\n❌ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY " +
        "no .env.local antes de rodar este script (veja .env.local.example).\n"
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n▶ Criando academia "${nome}" (slug: ${slug})...`);
  const { data: academia, error: erroAcademia } = await supabase
    .from("academias")
    .insert({ nome_fantasia: nome, slug_url: slug, endereco, telefone })
    .select()
    .single();

  if (erroAcademia) {
    console.error(`\n❌ Falha ao criar a academia: ${erroAcademia.message}`);
    console.error(
      "   Dica: o slug precisa ser único. Rodou o supabase/schema.sql neste projeto?\n"
    );
    process.exit(1);
  }

  console.log(`▶ Criando login do administrador (${email})...`);
  const { data: usuario, error: erroUsuario } =
    await supabase.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { nome: adminNome },
    });

  if (erroUsuario || !usuario?.user) {
    console.error(
      `\n❌ Falha ao criar o usuário: ${erroUsuario?.message ?? "erro desconhecido"}`
    );
    console.log("↩ Desfazendo a criação da academia...");
    await supabase.from("academias").delete().eq("id", academia.id);
    process.exit(1);
  }

  console.log("▶ Vinculando o administrador à academia...");
  const { error: erroPerfil } = await supabase.from("perfis_admin").insert({
    id: usuario.user.id,
    academia_id: academia.id,
    nome: adminNome,
    email,
  });

  if (erroPerfil) {
    console.error(`\n❌ Falha ao vincular o perfil: ${erroPerfil.message}`);
    console.log("↩ Desfazendo usuário e academia criados...");
    await supabase.auth.admin.deleteUser(usuario.user.id);
    await supabase.from("academias").delete().eq("id", academia.id);
    process.exit(1);
  }

  console.log("\n✅ Academia provisionada com sucesso!\n");
  console.log(`   Academia:  ${nome}  (slug: ${slug})`);
  console.log(`   Login:     ${email}`);
  console.log(`   Painel:    /painel/${slug}  (após o login)`);
  console.log(
    "\nPróximo passo: acesse /login no app com esse e-mail e senha.\n"
  );
}

main().catch((err) => {
  console.error("\n❌ Erro inesperado:", err);
  process.exit(1);
});
