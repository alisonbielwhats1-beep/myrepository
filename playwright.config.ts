import { defineConfig, devices } from "@playwright/test";

/**
 * Fase 1: E2E/UI só para páginas públicas, só local. Sem auth, sem Supabase
 * real, sem screenshots. `npm run dev` (não build+start): mais simples e
 * mais rápido de subir nesta fase — troca para produção fica para quando
 * isto entrar no CI.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
