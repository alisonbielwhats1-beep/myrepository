import { test, expect } from "@playwright/test";

/**
 * Detecta overflow horizontal (scrollWidth > clientWidth) nas páginas
 * públicas, nos três breakpoints principais. Foi exatamente esse tipo de
 * problema que causou o bug do modal "Gerenciar acesso" corrigido antes
 * desta fase.
 */
const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
];

const PAGINAS_PUBLICAS = ["/", "/login", "/privacidade", "/termos"];

for (const viewport of VIEWPORTS) {
  test.describe(`Responsividade @ ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const rota of PAGINAS_PUBLICAS) {
      test(`${rota} carrega sem erro e sem overflow horizontal`, async ({
        page,
      }) => {
        const erros: string[] = [];
        page.on("pageerror", (err) => erros.push(err.message));

        const resposta = await page.goto(rota);
        expect(resposta?.ok(), `${rota} respondeu com status de erro`).toBe(
          true
        );

        expect(erros, `erro de JavaScript não tratado em ${rota}`).toEqual(
          []
        );

        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));

        expect(
          scrollWidth,
          `overflow horizontal em ${rota} @ ${viewport.name}: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}`
        ).toBeLessThanOrEqual(clientWidth);
      });
    }
  });
}
