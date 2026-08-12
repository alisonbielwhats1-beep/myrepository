#!/usr/bin/env node
// -----------------------------------------------------------------------------
// AUDITORIA (read-only) — prontidão do ACESSO do aluno para o go-live.
//
// O aluno NÃO usa e-mail nem login: entra pelo link pessoal
// `/aluno/<slug>/<token_acesso_publico>`, enviado por WhatsApp (mensagemAcesso
// em lib/whats.ts) ou por QR Code apresentado na recepção. Então a prontidão
// dele NÃO tem nada a ver com e-mail — depende de duas coisas:
//
//   1. ter `token_acesso_publico` gerado  -> o link existe e funciona
//   2. ter telefone utilizável            -> dá pra MANDAR o link por WhatsApp
//      (quem não tem telefone bom ainda acessa pelo QR na recepção)
//
// Este script só LÊ (`select`); não gera token, não altera nada.
//
// Uso:
//   node scripts/auditoria-acesso-alunos.mjs                 # todas as academias
//   node scripts/auditoria-acesso-alunos.mjs --slug saude-e-vida
//   node scripts/auditoria-acesso-alunos.mjs --slug saude-e-vida --sem-telefone
//        (lista os alunos sem telefone utilizável, pra recepção completar)
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
  const out = { slug: "", semTelefone: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") out.slug = argv[++i] ?? "";
    else if (a === "--sem-telefone") out.semTelefone = true;
  }
  return out;
}

// Mesma régua do envio real: linkWhats (lib/whats.ts) recusa telefone com menos
// de 10 dígitos. Aqui só medimos, não formatamos.
function telefoneUtilizavel(telefone) {
  return (telefone ?? "").replace(/\D/g, "").length >= 10;
}

async function lerAlunos(supabase, academiaId) {
  const pagina = 1000;
  let de = 0;
  const alunos = [];
  for (;;) {
    let q = supabase
      .from("alunos")
      .select("id, nome, telefone, token_acesso_publico, status_matricula")
      .order("id", { ascending: true })
      .range(de, de + pagina - 1);
    if (academiaId) q = q.eq("academia_id", academiaId);
    const { data, error } = await q;
    if (error) throw new Error(`ao ler alunos: ${error.message}`);
    alunos.push(...data);
    if (data.length < pagina) break;
    de += pagina;
  }
  return alunos;
}

function auditar(alunos) {
  const r = {
    total: alunos.length,
    matricula_ativa: 0,
    com_token_acesso: 0,
    sem_token_acesso: 0,
    tokens_duplicados: 0,
    telefone_utilizavel_whats: 0,
    telefone_ausente_ou_curto: 0,
  };
  const vistos = new Map();
  for (const a of alunos) {
    if (a.status_matricula === "ativa") r.matricula_ativa += 1;
    if (a.token_acesso_publico) {
      r.com_token_acesso += 1;
      vistos.set(a.token_acesso_publico, (vistos.get(a.token_acesso_publico) ?? 0) + 1);
    } else {
      r.sem_token_acesso += 1;
    }
    if (telefoneUtilizavel(a.telefone)) r.telefone_utilizavel_whats += 1;
    else r.telefone_ausente_ou_curto += 1;
  }
  for (const [, n] of vistos) if (n > 1) r.tokens_duplicados += 1;
  return r;
}

async function main() {
  carregarEnvLocal();
  const args = parseArgs(process.argv.slice(2));

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

  let academiaId = null;
  let academiaNome = null;
  if (args.slug) {
    const { data: ac, error } = await supabase
      .from("academias")
      .select("id, nome_fantasia")
      .eq("slug_url", args.slug)
      .maybeSingle();
    if (error) throw new Error(`ao buscar academia: ${error.message}`);
    if (!ac) {
      console.error(`\n❌ Academia com slug "${args.slug}" não encontrada.\n`);
      process.exit(1);
    }
    academiaId = ac.id;
    academiaNome = ac.nome_fantasia;
  }

  const alunos = await lerAlunos(supabase, academiaId);
  const resumo = auditar(alunos);

  const saida = {
    escopo: args.slug
      ? { slug: args.slug, academia: academiaNome }
      : "todas_as_academias",
    ...resumo,
  };

  if (args.semTelefone) {
    saida.sem_telefone = alunos
      .filter((a) => !telefoneUtilizavel(a.telefone))
      .map((a) => ({ nome: a.nome, telefone: a.telefone ?? null }));
  }

  console.log(JSON.stringify(saida, null, 2));

  // Sanidade: quem tem token + quem não tem = total.
  if (resumo.com_token_acesso + resumo.sem_token_acesso !== resumo.total) {
    console.error("\n⚠ Contagem de token não fecha com o total.\n");
    process.exit(2);
  }
}

main().catch((err) => {
  console.error("\n❌ Erro na auditoria:", err.message ?? err);
  process.exit(1);
});
