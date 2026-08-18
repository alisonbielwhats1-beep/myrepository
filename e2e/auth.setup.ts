import { chromium } from "@playwright/test";
import path from "node:path";
import { mkdirSync } from "node:fs";

/**
 * globalSetup do Playwright — roda uma única vez, fora de qualquer arquivo de
 * teste, antes de todos os workers. Faz login real na UI como
 * demo@gestacad.com.br e salva a sessão em e2e/.auth/demo.json, para
 * e2e/treinos-acesso.spec.ts reusar via storageState.
 *
 * Sem credencial (E2E_DEMO_PASSWORD/DEMO_SENHA ausente): não faz nada — os
 * testes públicos (npm run test:e2e) não dependem disso e não podem falhar
 * por causa disso.
 */
export const authFile = path.join(__dirname, ".auth", "demo.json");
const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "demo@gestacad.com.br";

export default async function globalSetupAuth() {
  const senha = process.env.E2E_DEMO_PASSWORD ?? process.env.DEMO_SENHA;
  if (!senha) return;

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  mkdirSync(path.dirname(authFile), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail", { exact: true }).fill(DEMO_EMAIL);
  // getByLabel("Senha") é ambíguo aqui: o <label> envolve o campo, o botão
  // "Mostrar senha" e o link "Esqueceu a senha?" juntos, então o nome
  // acessível nunca é exatamente "Senha". input[name="senha"] é o mesmo
  // nome que o Server Action lê (formData.get("senha")).
  await page.locator('input[name="senha"]').fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/painel\//, { timeout: 15_000 });
  await context.storageState({ path: authFile });
  await browser.close();
}
