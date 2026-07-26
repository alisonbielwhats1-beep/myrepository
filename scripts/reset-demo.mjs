#!/usr/bin/env node
// =============================================================================
// scripts/reset-demo.mjs — Recria os dados de demonstração no tenant demo.
//
// Preserva: academia, usuário Auth, perfil administrador e configurações.
// Remove e recria: alunos, funcionários, planos, receitas, despesas,
//                  acessos, treinos de alunos, exercícios, progressos, produtos.
//
// Uso:
//   npm run reset-demo -- --confirmar
//
// Requer no ambiente (.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { createClient }             from '@supabase/supabase-js';
import { removerDadosDemo, inserirSeed, validarContagens } from './lib/demo-data.mjs';

const DEMO_SLUG = 'demonstracao';

function carregarEnv() {
  const caminho = new URL('../.env.local', import.meta.url);
  if (!existsSync(caminho)) return;
  const conteudo = readFileSync(caminho, 'utf8');
  for (const linha of conteudo.split('\n')) {
    const l = linha.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('=');
    if (eq === -1) continue;
    const chave = l.slice(0, eq).trim();
    let valor   = l.slice(eq + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const chave  = a.slice(2);
    const proximo = argv[i + 1];
    const valor  = proximo && !proximo.startsWith('--') ? argv[++i] : 'true';
    out[chave] = valor;
  }
  return out;
}

async function main() {
  carregarEnv();

  const args      = parseArgs(process.argv.slice(2));
  const confirmar = 'confirmar' in args;

  if (!confirmar) {
    console.error(
      '\n❌  Confirmação obrigatória.\n\n' +
      '    npm run reset-demo -- --confirmar\n\n' +
      '⚠   Este comando remove TODOS os dados fictícios do tenant de demonstração\n' +
      '    e os recria do zero. Tenant, usuário e configurações são preservados.\n'
    );
    process.exit(1);
  }

  const supabaseUrl    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\n❌  Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Localizar tenant demo ──────────────────────────────────────────────────
  const { data: academia, error: errAc } = await supabase
    .from('academias')
    .select('id, nome_fantasia, is_demo')
    .eq('slug_url', DEMO_SLUG)
    .maybeSingle();

  if (errAc || !academia) {
    console.error(
      `\n❌  Tenant "${DEMO_SLUG}" não encontrado.\n` +
      '    Execute primeiro: npm run criar-demo\n'
    );
    process.exit(1);
  }

  // ── Guardrail: obrigatório is_demo = true ──────────────────────────────────
  if (!academia.is_demo) {
    console.error(
      `\n❌  OPERAÇÃO BLOQUEADA\n\n` +
      `    O tenant "${academia.nome_fantasia}" (slug: ${DEMO_SLUG}) ` +
      `existe mas NÃO é marcado como demonstração (is_demo = false).\n` +
      '    Este script nunca altera tenants reais.\n'
    );
    process.exit(1);
  }

  console.log(`\n▶ Resetando dados de demonstração (academia: ${academia.id})...`);

  try {
    // ── Remover dados fictícios ────────────────────────────────────────────────
    process.stdout.write('▶ Removendo dados existentes...');
    await removerDadosDemo(supabase, academia.id);
    console.log(' ✓');

    // ── Recriar biblioteca de treinos ──────────────────────────────────────────
    process.stdout.write('▶ Recriando biblioteca de treinos...');
    const { error: errSeed } = await supabase.rpc('seed_treinos_padrao', {
      p_academia_id: academia.id,
    });
    if (errSeed) console.log(` ⚠  (${errSeed.message})`);
    else         console.log(' ✓');

    // ── Inserir novos dados ────────────────────────────────────────────────────
    console.log('▶ Inserindo novos dados de demonstração...');
    const contagens = await inserirSeed(supabase, academia.id);

    // ── Validar ────────────────────────────────────────────────────────────────
    console.log('▶ Validando contagens...');
    const { ok, relatorio } = await validarContagens(supabase, academia.id);
    relatorio.forEach(l => console.log(l));

    if (!ok) {
      throw new Error('Validação falhou — verifique os itens acima.');
    }

    const sep = '═'.repeat(60);
    console.log(`\n${sep}`);
    console.log(' RESET CONCLUÍDO COM SUCESSO');
    console.log(sep);
    console.log('  Dados recriados:');
    for (const [k, v] of Object.entries(contagens)) {
      console.log(`    ${k.padEnd(14)}: ${v}`);
    }
    console.log(sep + '\n');

  } catch (err) {
    console.error(`\n❌  ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌  Erro inesperado:', err.message);
  process.exit(1);
});
