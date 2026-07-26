#!/usr/bin/env node
// =============================================================================
// scripts/remover-demo.mjs — Remove completamente o tenant de demonstração.
//
// Remove: academia, usuário Auth, perfil e todos os dados associados.
// Exige confirmação interativa digitando exatamente: REMOVER DEMONSTRACAO
//
// Uso:
//   npm run remover-demo
//
// Requer no ambiente (.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { createInterface }          from 'node:readline';
import { createClient }             from '@supabase/supabase-js';

const DEMO_SLUG         = 'demonstracao';
const FRASE_CONFIRMACAO = 'REMOVER DEMONSTRACAO';

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

function lerLinha(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (resposta) => {
      rl.close();
      resolve(resposta.trim());
    });
  });
}

async function main() {
  carregarEnv();

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
      `\n❌  Tenant "${DEMO_SLUG}" não encontrado. Nada foi alterado.\n`
    );
    process.exit(1);
  }

  // ── Guardrail: obrigatório is_demo = true ──────────────────────────────────
  if (!academia.is_demo) {
    console.error(
      `\n❌  OPERAÇÃO BLOQUEADA\n\n` +
      `    O tenant "${academia.nome_fantasia}" (slug: ${DEMO_SLUG}) ` +
      `existe mas NÃO é marcado como demonstração (is_demo = false).\n` +
      '    Este script nunca remove tenants reais.\n'
    );
    process.exit(1);
  }

  // ── Exibir aviso e solicitar confirmação ───────────────────────────────────
  console.log('\n' + '▲'.repeat(60));
  console.log(' ATENÇÃO — REMOÇÃO PERMANENTE DO TENANT DE DEMONSTRAÇÃO');
  console.log('▲'.repeat(60));
  console.log(`\n  Academia : ${academia.nome_fantasia}`);
  console.log(`  ID       : ${academia.id}`);
  console.log(`  Slug     : ${DEMO_SLUG}`);
  console.log('\n  Esta operação removerá PERMANENTEMENTE:');
  console.log('    • A academia e todos os seus dados');
  console.log('    • O usuário Auth e o perfil administrador');
  console.log('\n  Esta ação não pode ser desfeita.\n');

  const confirmacao = await lerLinha(
    `  Para confirmar, digite exatamente: ${FRASE_CONFIRMACAO}\n  > `
  );

  if (confirmacao !== FRASE_CONFIRMACAO) {
    console.log('\n  Confirmação incorreta. Operação cancelada.\n');
    process.exit(0);
  }

  console.log('');

  try {
    // ── Coletar perfis vinculados ──────────────────────────────────────────────
    const { data: perfis } = await supabase
      .from('perfis_admin')
      .select('id')
      .eq('academia_id', academia.id);

    // ── Remover usuários Auth ──────────────────────────────────────────────────
    if (perfis && perfis.length > 0) {
      process.stdout.write(`▶ Removendo ${perfis.length} usuário(s) Auth...`);
      const falhasAuth = [];
      for (const perfil of perfis) {
        const { error } = await supabase.auth.admin.deleteUser(perfil.id);
        if (error) falhasAuth.push(`${perfil.id}: ${error.message}`);
      }
      if (falhasAuth.length > 0) {
        console.log('');
        falhasAuth.forEach(f => console.error(`  ⚠  ${f}`));
      } else {
        console.log(' ✓');
      }
    }

    // ── Remover academia (CASCADE elimina todos os dados) ──────────────────────
    process.stdout.write('▶ Removendo academia e dados associados (CASCADE)...');
    const { error: errDel } = await supabase
      .from('academias')
      .delete()
      .eq('id', academia.id);

    if (errDel) throw new Error(`Falha ao remover academia: ${errDel.message}`);
    console.log(' ✓');

    console.log('\n✅  Tenant de demonstração removido com sucesso.\n');

  } catch (err) {
    console.error(`\n❌  ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌  Erro inesperado:', err.message);
  process.exit(1);
});
