import { defineConfig, devices } from "@playwright/test";

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
