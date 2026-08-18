import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Carrega .env.local no processo de teste (o Node do Playwright não lê esse
 * arquivo sozinho — só o `next dev`/`next start` que ele sobe fazem isso).
 * Mesma técnica manual já usada em scripts/criar-demo.mjs, sem adicionar
 * dependência nova. Não faz nada em CI (lá as env já vêm do workflow).
 */
function carregarEnvLocal() {
  const caminho = path.join(__dirname, ".env.local");
  if (!existsSync(caminho)) return;
  for (const linha of readFileSync(caminho, "utf8").split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const eq = l.indexOf("=");
    if (eq === -1) continue;
    const chave = l.slice(0, eq).trim();
    let valor = l.slice(eq + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (!(chave in process.env)) process.env[chave] = valor;
  }
}
if (!process.env.CI) carregarEnvLocal();

/**
 * E2E/UI só para páginas públicas. Sem auth, sem Supabase real, sem
 * screenshots de regressão visual.
 *
 * webServer: local usa `npm run dev` (mais rápido de subir, com watch).
 * No CI usa `npm run build && npm run start` — mais fiel ao que a Vercel
 * serve de verdade, e o build do CI já roda com env fictícias (nenhuma das
 * rotas testadas aqui — /, /login, /privacidade, /termos — chama o Supabase
 * na renderização; o login só toca a Auth ao SUBMETER o formulário, o que
 * estes testes não fazem).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // Login único do tenant demo (quando E2E_DEMO_PASSWORD/DEMO_SENHA existir);
  // sem credencial, é um no-op — não afeta os testes públicos.
  globalSetup: "./e2e/auth.setup.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // No CI o comando faz build antes de subir o servidor (~1,5min neste
    // projeto) — 120s não sobrava margem nenhuma para o "start" depois.
    timeout: process.env.CI ? 300_000 : 120_000,
  },
});
