import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { authFile } from "./auth.setup";

/**
 * Fase 3: fluxo autenticado — login → painel → treinos → "Gerenciar acesso"
 * → modal. Só o tenant de demonstração (is_demo=true), só leitura/navegação:
 * nenhum dado é criado, editado ou excluído.
 *
 * O login em si acontece uma vez em e2e/auth.setup.ts (globalSetup do
 * Playwright), que grava a sessão em e2e/.auth/demo.json; aqui só reusamos
 * via storageState. Requer E2E_DEMO_PASSWORD no ambiente — a senha do
 * usuário demo@gestacad.com.br. No CI vem do GitHub Secret de mesmo nome;
 * localmente pode vir de .env.local (ou de DEMO_SENHA, mesma variável que
 * scripts/criar-demo.mjs já usa). NÃO faz parte do `npm run test:e2e` (que o
 * CI roda nos testes públicos); use `npm run test:e2e:auth`.
 */

const SLUG_DEMO = "demonstracao";

test.beforeAll(() => {
  if (!existsSync(authFile)) {
    throw new Error(
      "Sessão do tenant demo não encontrada (e2e/.auth/demo.json). " +
        "E2E_DEMO_PASSWORD (ou DEMO_SENHA) não está definida no ambiente — " +
        "no CI vem do GitHub Secret; localmente, defina com a senha de " +
        "demo@gestacad.com.br para rodar os testes autenticados."
    );
  }
});

/**
 * Abre a lista de treinos e o modal "Gerenciar acesso" de um treino que já
 * tem o link público ativo. Não mira um nome específico de treino: os dados
 * do tenant demo mudam com o tempo (seed foi de 25 para 29 treinos entre o
 * diagnóstico e a implementação deste teste), então a busca é pelo selo
 * "Link ativo" — o mesmo sinal visual de `publico: true` — o que deixa o
 * teste resiliente a essas mudanças sem precisar clicar em nada que escreva
 * no banco.
 */
async function abrirModalGerenciarAcesso(page: Page) {
  await page.goto(`/painel/${SLUG_DEMO}/treinos`);
  await expect(page).toHaveURL(new RegExp(`/painel/${SLUG_DEMO}/treinos`));

  // Escopo ao card do treino: menor <div> que contém o selo "Link ativo" E
  // um botão "Mais ações" — evita depender de classes CSS.
  const card = page
    .locator("div")
    .filter({ hasText: "Link ativo" })
    .filter({ has: page.getByTitle("Mais ações") })
    .last();

  await card.getByTitle("Mais ações").click();
  await page.getByRole("menuitem", { name: "Gerenciar acesso" }).click();

  const dialog = page.getByRole("dialog", { name: "Gerenciar acesso" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function semOverflowHorizontal(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  const overflowModal = await dialog.evaluate(
    (el) => el.scrollWidth > el.clientWidth
  );
  const overflowPagina = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  return { overflowModal, overflowPagina };
}

test.describe("Treinos — Gerenciar acesso (autenticado)", () => {
  test.use({ storageState: authFile });

  test("login → painel → treinos → modal abre com o conteúdo esperado", async ({
    page,
  }) => {
    const dialog = await abrirModalGerenciarAcesso(page);

    await expect(
      dialog.getByRole("heading", { name: "Gerenciar acesso" })
    ).toBeVisible();
    await expect(dialog.locator("canvas")).toBeVisible();
    await expect(dialog.getByText(/\/treino\//)).toBeVisible();

    const copiarLink = dialog.getByRole("button", { name: "Copiar link" });
    const baixarQr = dialog.getByRole("button", { name: "Baixar QR" });
    await expect(copiarLink).toBeVisible();
    await expect(copiarLink).toBeEnabled();
    await expect(baixarQr).toBeVisible();
    await expect(baixarQr).toBeEnabled();

    const { overflowModal, overflowPagina } = await semOverflowHorizontal(
      page,
      dialog
    );
    expect(
      overflowModal,
      "modal com overflow horizontal — regressão do bug corrigido com min-w-0"
    ).toBe(false);
    expect(overflowPagina, "página com overflow horizontal (modal aberto)").toBe(
      false
    );
  });
});

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Gerenciar acesso @ ${viewport.name}`, () => {
    test.use({
      storageState: authFile,
      viewport: { width: viewport.width, height: viewport.height },
    });

    test("modal abre, ações ficam acessíveis, sem overflow horizontal", async ({
      page,
    }) => {
      const dialog = await abrirModalGerenciarAcesso(page);

      await expect(
        dialog.getByRole("button", { name: "Copiar link" })
      ).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Baixar QR" })
      ).toBeVisible();

      const { overflowModal, overflowPagina } = await semOverflowHorizontal(
        page,
        dialog
      );
      expect(overflowModal, `overflow no modal @ ${viewport.name}`).toBe(false);
      expect(overflowPagina, `overflow na página @ ${viewport.name}`).toBe(
        false
      );
    });
  });
}
