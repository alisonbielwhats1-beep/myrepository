#!/usr/bin/env node
// =============================================================================
// scripts/criar-demo.mjs — Provisiona o tenant de demonstração do GestAcad.
//
// Uso:
//   npm run criar-demo
//
// A senha do usuário dono é solicitada de forma interativa (sem eco) ou lida
// de DEMO_SENHA no .env.local (para CI/automação).
//
// Nunca aceita --senha como argumento de linha de comando.
// Nunca imprime credenciais em logs.
//
// Requer no ambiente (.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { createInterface }          from 'node:readline';
import { createClient }             from '@supabase/supabase-js';
import { inserirSeed, validarContagens } from './lib/demo-data.mjs';

const DEMO_SLUG  = 'demonstracao';
const DEMO_NOME  = 'GestAcad Demonstração';
const DEMO_EMAIL = 'demo@gestacad.com.br';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

/**
 * Lê a senha do usuário demo.
 * Prioridade: variável de ambiente DEMO_SENHA → prompt interativo oculto.
 * Nunca aceita --senha em argv.
 */
async function lerSenha() {
  // 1. Variável de ambiente (CI/automação)
  if (process.env.DEMO_SENHA) {
    console.log('  ℹ  Senha lida de DEMO_SENHA (modo CI).');
    return process.env.DEMO_SENHA;
  }

  // 2. Prompt interativo com entrada oculta
  if (!process.stdin.isTTY) {
    console.error(
      '\n❌  stdin não é um terminal interativo e DEMO_SENHA não está definida.\n' +
      '    Para uso em CI/automação: defina DEMO_SENHA no .env.local.\n' +
      '    Atenção: o comando de atribuição em si pode aparecer no histórico do shell.\n'
    );
    process.exit(1);
  }

  return new Promise((resolve, reject) => {
    process.stdout.write('  Senha do usuário demo (não será exibida): ');
    const chars = [];

    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();

    function handler(char) {
      switch (char) {
        case '\r':
        case '\n':
        case '': // Ctrl+D
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', handler);
          process.stdout.write('\n');
          if (chars.length < 8) {
            reject(new Error('A senha deve ter pelo menos 8 caracteres.'));
          } else {
            resolve(chars.join(''));
          }
          break;
        case '': // Ctrl+C
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('Cancelado pelo usuário (Ctrl+C).'));
          break;
        case '': // Backspace
          if (chars.length > 0) chars.pop();
          break;
        default:
          chars.push(char);
      }
    }

    process.stdin.on('data', handler);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rollback lógico
// ─────────────────────────────────────────────────────────────────────────────

async function rollback(supabase, estado) {
  console.error('\n↩  Iniciando rollback das etapas criadas nesta execução...');
  const falhas = [];

  if (estado.perfilCriado && estado.usuarioCriadoId) {
    const { error } = await supabase
      .from('perfis_admin')
      .delete()
      .eq('id', estado.usuarioCriadoId);
    if (error) falhas.push(`perfis_admin: ${error.message}`);
    else       console.error('  ✓ perfil_admin removido');
  }

  if (estado.usuarioCriadoId) {
    const { error } = await supabase.auth.admin.deleteUser(estado.usuarioCriadoId);
    if (error) falhas.push(`auth.user: ${error.message}`);
    else       console.error('  ✓ usuário Auth removido');
  }

  if (estado.academiaCriadaId) {
    const { error } = await supabase
      .from('academias')
      .delete()
      .eq('id', estado.academiaCriadaId);
    if (error) falhas.push(`academia: ${error.message}`);
    else       console.error('  ✓ academia removida');
  }

  if (falhas.length > 0) {
    console.error('\n⚠  Falhas durante o rollback — verifique manualmente o banco:');
    falhas.forEach(f => console.error(`  • ${f}`));
  } else {
    console.error('  ✓ Rollback concluído sem erros residuais.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  carregarEnv();

  // ── Verificar variáveis de ambiente ────────────────────────────────────────
  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      '\n❌  Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ' +
      'no .env.local antes de rodar este script.\n'
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Detectar coluna is_demo (migration 023 pendente) ──────────────────────
  const { error: probeErr } = await supabase
    .from('academias')
    .select('is_demo')
    .limit(0);

  if (probeErr?.message?.includes('is_demo')) {
    console.error(
      '\n❌  A coluna academias.is_demo não existe.\n' +
      '    Existem migrations pendentes. Execute:\n\n' +
      '      supabase db push\n\n' +
      '    Ou, se não usar a CLI do Supabase, aplique manualmente:\n' +
      '      supabase/migrations/023_tenant_demo.sql\n'
    );
    process.exit(1);
  }

  // ── Verificar se o slug já existe ─────────────────────────────────────────
  const { data: existente } = await supabase
    .from('academias')
    .select('id, is_demo, nome_fantasia')
    .eq('slug_url', DEMO_SLUG)
    .maybeSingle();

  if (existente) {
    if (!existente.is_demo) {
      console.error(
        `\n❌  O slug "${DEMO_SLUG}" já está em uso por um tenant real ` +
        `("${existente.nome_fantasia}").\n` +
        '    Este script nunca altera tenants reais.\n'
      );
      process.exit(1);
    }
    console.error(
      `\n❌  O tenant de demonstração já existe (id: ${existente.id}).\n` +
      '    • Para recriar os dados:  npm run reset-demo\n' +
      '    • Para remover tudo:      npm run remover-demo\n'
    );
    process.exit(1);
  }

  // ── Solicitar senha ────────────────────────────────────────────────────────
  console.log(`\n▶ Provisionando tenant de demonstração: "${DEMO_NOME}"\n`);
  const senha = await lerSenha();

  // Estado para rollback lógico
  const estado = {
    academiaCriadaId: null,
    usuarioCriadoId:  null,
    perfilCriado:     false,
  };

  try {
    // ── Etapa A: Criar academia ──────────────────────────────────────────────
    process.stdout.write('▶ Criando academia...');
    const { data: academia, error: errAc } = await supabase
      .from('academias')
      .insert({
        nome_fantasia:    DEMO_NOME,
        slug_url:         DEMO_SLUG,
        is_demo:          true,
        plano_saas:       'premium',
        gympass_status:   'desativada',
        totalpass_status: 'desativada',
      })
      .select()
      .single();

    if (errAc || !academia) {
      throw new Error(`Falha ao criar academia: ${errAc?.message ?? 'erro desconhecido'}`);
    }
    estado.academiaCriadaId = academia.id;
    console.log(` ✓ (id: ${academia.id})`);

    // ── Etapa B: Criar usuário Auth ──────────────────────────────────────────
    process.stdout.write('▶ Criando usuário Auth...');
    const { data: usuarioData, error: errUsr } = await supabase.auth.admin.createUser({
      email:          DEMO_EMAIL,
      password:       senha,
      email_confirm:  true,
      user_metadata:  { nome: 'Administrador Demo' },
    });

    if (errUsr || !usuarioData?.user) {
      throw new Error(`Falha ao criar usuário: ${errUsr?.message ?? 'erro desconhecido'}`);
    }
    estado.usuarioCriadoId = usuarioData.user.id;
    console.log(' ✓');

    // ── Etapa C: Vincular perfil_admin ───────────────────────────────────────
    process.stdout.write('▶ Vinculando perfil administrador...');
    const { error: errPerfil } = await supabase.from('perfis_admin').insert({
      id:          estado.usuarioCriadoId,
      academia_id: academia.id,
      nome:        'Administrador Demo',
      email:       DEMO_EMAIL,
      papel:       'dono',
    });

    if (errPerfil) {
      throw new Error(`Falha ao criar perfil: ${errPerfil.message}`);
    }
    estado.perfilCriado = true;
    console.log(' ✓');

    // ── Etapa D: Treinos padrão (biblioteca) ─────────────────────────────────
    process.stdout.write('▶ Populando biblioteca de treinos...');
    const { error: errSeed } = await supabase.rpc('seed_treinos_padrao', {
      p_academia_id: academia.id,
    });
    if (errSeed) {
      // Não bloqueia: a função pode ainda não existir em algumas versões
      console.log(` ⚠  (${errSeed.message})`);
    } else {
      console.log(' ✓');
    }

    // ── Etapa E: Seed de dados demo ───────────────────────────────────────────
    console.log('▶ Inserindo dados de demonstração...');
    const contagens = await inserirSeed(supabase, academia.id);

    // ── Etapa F: Validar contagens ────────────────────────────────────────────
    console.log('▶ Validando contagens...');
    const { ok, relatorio } = await validarContagens(supabase, academia.id);
    relatorio.forEach(l => console.log(l));

    if (!ok) {
      throw new Error('Validação de contagens falhou — verifique os itens acima.');
    }

    // ── Sucesso ───────────────────────────────────────────────────────────────
    const sep = '═'.repeat(60);
    console.log(`\n${sep}`);
    console.log(' TENANT DE DEMONSTRAÇÃO CRIADO COM SUCESSO');
    console.log(sep);
    console.log(`  Nome    : ${DEMO_NOME}`);
    console.log(`  Slug    : ${DEMO_SLUG}`);
    console.log(`  Login   : ${DEMO_EMAIL}`);
    console.log(`  Painel  : /painel/${DEMO_SLUG}`);
    console.log(`  Plano   : premium`);
    console.log('');
    console.log('  Dados inseridos:');
    for (const [k, v] of Object.entries(contagens)) {
      console.log(`    ${k.padEnd(14)}: ${v}`);
    }
    console.log(sep + '\n');

  } catch (err) {
    console.error(`\n❌  ${err.message}`);
    await rollback(supabase, estado);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌  Erro inesperado:', err.message);
  process.exit(1);
});
