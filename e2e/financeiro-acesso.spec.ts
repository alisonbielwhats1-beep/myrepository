import { test, expect } from "@playwright/test";
import { authFile } from "./auth.setup";

/**
 * Fase 3 / Lote 1 (Financeiro) — fluxo autenticado, SOMENTE LEITURA no tenant
 * demo. Nenhuma cobrança é criada, paga ou cancelada: os botões de geração são
 * conferidos como visíveis/habilitados, nunca clicados.
 *
 * Login (via e2e/auth.setup.ts, mesmo storageState da Fase 3) é do usuário
 * demo@gestacad.com.br, papel "dono" — o único papel que enxerga a seção
 * Financeiro (lib/permissoes.ts). O bloqueio a gerente/recepção/instrutor já
 * é coberto de forma mais forte e direta em
 * supabase/ci/22_teste_financeiro_rls_rpc.sql (RLS real, banco real) — este
 * spec não tenta reproduzir isso via login, porque não existe credencial de
 * demonstração para os outros papéis. O teste "sem sessão" abaixo cobre só o
 * caso não-autenticado, que é o único que dá pra exercitar com segurança
 * pelo navegador nesta fase.
 */

const SLUG_DEMO = "demonstracao";

test.describe("Financeiro — acesso do dono (autenticado)", () => {
  test.use({ storageState: authFile });

  test("dono abre Financeiro: KPIs carregam", async ({ page }) => {
    await page.goto(`/painel/${SLUG_DEMO}/financeiro`);
    await expect(page).toHaveURL(new RegExp(`/painel/${SLUG_DEMO}/financeiro$`));

    await expect(page.getByText("Receita recebida", { exact: true })).toBeVisible();
    await expect(page.getByText("Despesa paga", { exact: true })).toBeVisible();
    await expect(page.getByText("Resultado", { exact: true })).toBeVisible();
    await expect(page.getByText("Saldo registrado", { exact: true })).toBeVisible();
  });

  test("filtros e botão de sincronizar cobranças aparecem, sem clicar", async ({
    page,
  }) => {
    await page.goto(`/painel/${SLUG_DEMO}/financeiro/receitas`);

    // getByLabel não serve aqui: o <label> envolve o <select> inteiro, então o
    // nome acessível inclui o texto da opção selecionada (mesmo padrão do
    // campo "Senha" no login — ver auth.setup.ts). E "Tipo" sozinho também bate
    // no <th> da tabela de lançamentos — por isso escopamos ao <label>.
    await expect(page.locator("label").filter({ hasText: "Pagamento" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Tipo" })).toBeVisible();

    const sincronizar = page.getByRole("button", {
      name: "Sincronizar cobranças",
    });
    await expect(sincronizar).toBeVisible();
    await expect(sincronizar).toBeEnabled();
  });
});

test("visitante sem sessão é redirecionado para /login, não para o Financeiro", async ({
  browser,
}) => {
  // Contexto novo, sem storageState — nenhuma sessão. Cobre o caso
  // não-autenticado; não substitui um teste por papel (ver comentário acima).
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/painel/${SLUG_DEMO}/financeiro`);
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`Financeiro @ ${viewport.name}`, () => {
    test.use({
      storageState: authFile,
      viewport: { width: viewport.width, height: viewport.height },
    });

    test("KPIs carregam sem overflow horizontal", async ({ page }) => {
      await page.goto(`/painel/${SLUG_DEMO}/financeiro`);
      await expect(page.getByText("Receita recebida", { exact: true })).toBeVisible();

      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
      );
      expect(overflow, `overflow horizontal @ ${viewport.name}`).toBe(false);
    });
  });
}
