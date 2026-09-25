import { test, expect } from "@playwright/test";

test.describe("Landing — CTAs públicos", () => {
  test("'Ver o sistema' leva até #painel", async ({ page }) => {
    await page.goto("/");

    const verOSistema = page.getByRole("link", { name: "Ver o sistema" });
    await expect(verOSistema).toBeVisible();

    await verOSistema.click();

    await expect(page).toHaveURL(/#painel$/);
    await expect(page.locator("#painel")).toBeVisible();
  });

  test("'O produto' (menu) leva até #painel", async ({ page }) => {
    await page.goto("/");

    const oProduto = page.getByRole("link", { name: "O produto" });
    await oProduto.click();

    await expect(page).toHaveURL(/#painel$/);
    await expect(page.locator("#painel")).toBeVisible();
  });

  test("CTA verde 'Quero conhecer o GestAcad' está visível", async ({
    page,
  }) => {
    await page.goto("/");

    // Não clicamos: o destino é um link externo (WhatsApp). O mesmo rótulo
    // se repete nos cartões de preço; aqui o que importa é o do topo.
    await expect(
      page.locator(".ls-hero").getByRole("link", { name: "Quero conhecer o GestAcad" })
    ).toBeVisible();
  });

  test("'Planos' mostra as faixas e a chave anual troca os valores", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("#planos").scrollIntoViewIfNeeded();

    const start = page.locator(".ls-preco").first();
    await expect(page.locator(".ls-preco")).toHaveCount(3);
    await expect(start.locator(".ls-preco__mensal strong")).toHaveText("R$ 99,90");

    const chave = page.getByRole("switch", { name: /Pagamento anual/ });
    await expect(chave).toHaveAttribute("aria-checked", "false");
    await chave.click();
    await expect(chave).toHaveAttribute("aria-checked", "true");

    // 20% sobre R$ 99,90 = R$ 79,92/mês, R$ 959,04 no ano.
    await expect(start.locator(".ls-preco__anual strong")).toHaveText("R$ 79,92");
    await expect(start.locator(".ls-preco__anual strong")).toHaveCSS("opacity", "1");
    await expect(start.locator(".ls-preco__cobranca")).toContainText("R$ 959,04");
  });
});
