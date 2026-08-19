#!/usr/bin/env node
// =============================================================================
// scripts/reset-demo-senha.mjs — Redefine SOMENTE a senha do usuário de
// demonstração (demo@gestacad.com.br) no Supabase Auth.
//
// Por que existe: `reset-demo` preserva o usuário Auth (não mexe na senha) e
// `criar-demo` só CRIA. Quando o login demo passa a dar "senha incorreta"
// (senha divergiu do esperado), este script realinha a senha — sem tocar em
// nenhum outro usuário nem em dados.
//
// Alvo fixo e único: demo@gestacad.com.br. Nunca aceita outro e-mail.
//
// Uso:
//   npm run reset-demo-senha -- --confirmar
//   → pergunta a senha no terminal (digitação oculta). Sem editar arquivo.
//   Alternativa: definir DEMO_SENHA no .env.local (usada automaticamente).
//
// Requer no ambiente (.env.local):
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const DEMO_EMAIL = 'demo@gestacad.com.br';

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
    let valor = l.slice(eq + 1).trim();
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}

/**
 * Lê a senha: usa DEMO_SENHA se existir; senão, pergunta no terminal com a
 * digitação OCULTA (não ecoa, não fica no histórico). Mínimo de 8 caracteres.
 */
async function lerSenha() {
  if (process.env.DEMO_SENHA) {
    console.log('  ℹ  Senha lida de DEMO_SENHA.');
    return process.env.DEMO_SENHA;
  }
  if (!process.stdin.isTTY) {
    throw new Error(
      'Terminal nao interativo e DEMO_SENHA nao definida. Defina DEMO_SENHA no .env.local ou rode num terminal normal.'
    );
  }
  return new Promise((resolve, reject) => {
    process.stdout.write('  Nova senha do demo (nao aparece enquanto digita): ');
    const chars = [];
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    // Um evento 'data' pode trazer VÁRIOS caracteres de uma vez (colar, ou o
    // terminal do Windows entregando a linha em bloco). Por isso iteramos char
    // a char — tratar o bloco inteiro como um "caractere" corrompia a senha
    // (ex.: incluía o \r do Enter no fim).
    function handler(data) {
      for (const char of data) {
        const code = char.charCodeAt(0);
        if (char === '\r' || char === '\n' || code === 4) {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.off('data', handler);
          process.stdout.write('\n');
          if (chars.length < 8) reject(new Error('A senha deve ter pelo menos 8 caracteres.'));
          else resolve(chars.join(''));
          return;
        } else if (code === 3) {
          process.stdin.setRawMode(false);
          process.stdout.write('\n');
          reject(new Error('Cancelado (Ctrl+C).'));
          return;
        } else if (code === 127 || code === 8) {
          if (chars.length > 0) chars.pop();
        } else {
          chars.push(char);
        }
      }
    }
    process.stdin.on('data', handler);
  });
}

async function acharUsuarioPorEmail(supabase, email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const achado = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase());
    if (achado) return achado;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main() {
  carregarEnv();

  if (!process.argv.slice(2).includes('--confirmar')) {
    console.error(
      '\n❌  Confirmacao obrigatoria.\n\n' +
      '    npm run reset-demo-senha -- --confirmar\n\n' +
      `⚠   Redefine a senha de ${DEMO_EMAIL}. Nao altera nenhum outro usuario nem dado.\n`
    );
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('\n❌  Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.\n');
    process.exit(1);
  }

  const senha = await lerSenha();

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n▶ Procurando ${DEMO_EMAIL}...`);
  const usuario = await acharUsuarioPorEmail(supabase, DEMO_EMAIL);
  if (!usuario) {
    console.error(`\n❌  Usuario ${DEMO_EMAIL} nao encontrado. Rode primeiro: npm run criar-demo\n`);
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.updateUserById(usuario.id, { password: senha });
  if (error) {
    console.error(`\n❌  Falha ao redefinir a senha: ${error.message}\n`);
    process.exit(1);
  }

  console.log(`✓ Senha de ${DEMO_EMAIL} redefinida com sucesso. Ja da para entrar.\n`);
}

main().catch((err) => {
  console.error('\n❌  Erro inesperado:', err.message);
  process.exit(1);
});
