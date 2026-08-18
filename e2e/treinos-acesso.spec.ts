import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Fase 3: fluxo autenticado — login → painel → treinos → "Gerenciar acesso"
 * → modal. Só o tenant de demonstração (is_demo=true), só leitura/navegação:
 * nenhum dado é criado, editado ou excluído.
 *
 * Requer E2E_DEMO_PASSWORD no ambiente — a senha do usuário
 * demo@gestacad.com.br. No CI vem do GitHub Secret de mesmo nome; localmente
 * pode vir de .env.local (ou de DEMO_SENHA, mesma variável que
 * scripts/criar-demo.mjs já usa, como alternativa). NÃO faz parte do
 * `npm run test:e2e` (que o CI roda nos testes públicos); use
 * `npm run test:e2e:auth`.
 */

const authFile = path.join(__dirname, ".auth", "demo.json");
// Tenant de demo, não é credencial sensível — já é literal público em
// scripts/criar-demo.mjs. Pode ser sobrescrito por E2E_DEMO_EMAIL se algum
// dia o tenant de teste mudar.
const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "demo@gestacad.com.br";
const SLUG_DEMO = "demonstracao";

// Confirmado por leitura direta do banco (somente select) antes de escrever
// este teste: dos 25 treinos do tenant demo, nenhum é "plataforma" (todos são
// origem_tipo "academia"/"instrutor"), então "Gerenciar acesso" aparece para
// qualquer um deles com o papel "dono". Este treino específico já está com o
// link público ATIVO no seed — por isso o teste consegue validar QR/link sem
// precisar ativar nada (ficando só leitura/navegação, sem escrever no banco).
const TREINO_COM_LINK_ATIVO = "Treino A – Peito e Tríceps";

test.beforeAll(async ({ browser }) => {
  const senha = process.env.E2E_DEMO_PASSWORD ?? process.env.DEMO_SENHA;
  if (!senha) {
    throw new Error(
      "E2E_DEMO_PASSWORD não está definida. No CI vem do GitHub Secret de " +
        "mesmo nome; localmente, defina E2E_DEMO_PASSWORD (ou DEMO_SENHA) " +
        "com a senha de demo@gestacad.com.br para rodar os testes autenticados."
    );
  }

  const page = await browser.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(DEMO_EMAIL);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(/\/painel\//, { timeout: 15_000 });
  await page.context().storageState({ path: authFile });
  await page.close();
});

/** Abre a lista de treinos e o modal "Gerenciar acesso" do treino-alvo. */
async function abrirModalGerenciarAcesso(page: Page) {
  await page.goto(`/painel/${SLUG_DEMO}/treinos`);
  await expect(page).toHaveURL(new RegExp(`/painel/${SLUG_DEMO}/treinos`));

  // Escopo ao card do treino específico: menor <div> que contém o nome do
  // treino E um botão "Mais ações" — evita depender de classes CSS ou de
  // posição na lista.
  const card = page
    .locator("div")
    .filter({ hasText: TREINO_COM_LINK_ATIVO })
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
