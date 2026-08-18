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

    // Não clicamos: o destino é um link externo (WhatsApp).
    await expect(
      page.getByRole("link", { name: "Quero conhecer o GestAcad" })
    ).toBeVisible();
  });
});
