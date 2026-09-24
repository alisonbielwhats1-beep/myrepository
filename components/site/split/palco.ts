/**
 * Coreografia própria da landing em tela dividida. O engine (scrollcraft)
 * pina os atos e publica `--sc-p` em cada um; este arquivo só LÊ esse valor e
 * decide o que ele significa aqui:
 *
 * - a divisória partida enquanto o ato "Sem sistema" está na tela;
 * - o colapso do fechamento (a divisória corre para a borda);
 * - os passos do ato "Conexão", que tocam a travessia uma vez ao entrar;
 * - os vídeos em loop, que só carregam perto da tela.
 *
 * Nada aqui altera o engine.
 */

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function progresso(el: Element | null): number {
  if (!el) return 0;
  const v = parseFloat((el as HTMLElement).style.getPropertyValue("--sc-p"));
  return Number.isFinite(v) ? v : 0;
}

export function iniciarPalco(root: HTMLElement) {
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = matchMedia("(min-width: 1024px)");
  const ponteiroFino = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const atoSem = root.querySelector("#problemas");
  const atoFim = root.querySelector("#planos");
  const hero = root.querySelector<HTMLElement>(".ls-hero");

  function medirLargura() {
    root.style.setProperty("--ls-vw", `${document.documentElement.clientWidth}px`);
  }
  medirLargura();
  addEventListener("resize", medirLargura, { passive: true });

  let linhaAtual = "";
  function atualizarLinha() {
    let estado = "";
    if (atoSem) {
      const r = atoSem.getBoundingClientRect();
      if (r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.45) estado = "partida";
    }
    if (estado !== linhaAtual) {
      linhaAtual = estado;
      if (estado) root.setAttribute("data-ls-linha", estado);
      else root.removeAttribute("data-ls-linha");
    }
  }

  function atualizarFechamento() {
    if (!desktop.matches) {
      root.style.setProperty("--ls-split", "0.5");
      root.style.setProperty("--ls-fim-t", "1");
      return;
    }
    const p = progresso(atoFim);
    const t = reduzido ? (p > 0 ? 1 : 0) : suave(clamp((p - 0.08) / 0.62));
    const vw = document.documentElement.clientWidth || innerWidth;
    const coluna = Math.min(26 * 16, vw * 0.34);
    const final = 1 - coluna / vw;
    root.style.setProperty("--ls-fim-t", t.toFixed(4));
    root.style.setProperty("--ls-split", (0.5 + (final - 0.5) * t).toFixed(4));
  }

  // Ponteiro fino: o hero inclina levemente com o mouse (camadas em taxas
  // diferentes). Nunca captura o cursor; toque e teclado não dependem disso.
  let mxAlvo = 0;
  let mx = 0;
  if (hero && ponteiroFino && !reduzido) {
    hero.addEventListener(
      "pointermove",
      (e) => {
        mxAlvo = (e.clientX / innerWidth - 0.5) * 2;
      },
      { passive: true }
    );
    hero.addEventListener("pointerleave", () => (mxAlvo = 0), { passive: true });
  }

  function quadro() {
    atualizarLinha();
    atualizarFechamento();
    if (hero && Math.abs(mxAlvo - mx) > 0.001) {
      mx += (mxAlvo - mx) * 0.08;
      hero.style.setProperty("--ls-mx", mx.toFixed(4));
    }
    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);

  // Passos do ato "Conexão": cada linha toca a travessia uma vez, quando já
  // está bem dentro da tela. Sem observer ou com movimento reduzido, todas
  // entram direto no estado final.
  const passos = Array.from(root.querySelectorAll<HTMLElement>(".ls-passo"));
  if (reduzido || !("IntersectionObserver" in window)) {
    passos.forEach((el) => el.setAttribute("data-on", ""));
  } else {
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach(({ target, isIntersecting }) => {
          if (!isIntersecting) return;
          target.setAttribute("data-on", "");
          io.unobserve(target);
        });
      },
      { rootMargin: "0px 0px -30% 0px", threshold: 0.35 }
    );
    passos.forEach((el) => io.observe(el));
  }

  // Loops dos vídeos: fonte só perto da tela, pausa fora dela, e sob
  // movimento reduzido fica só o poster.
  const loops = Array.from(root.querySelectorAll<HTMLVideoElement>("video.ls-loop"));
  if (!reduzido && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach(({ target, isIntersecting }) => {
          const v = target as HTMLVideoElement;
          if (isIntersecting) {
            // No celular, a versão menor do clipe.
            const fonte = (!desktop.matches && v.dataset.srcMovel) || v.dataset.src;
            if (!v.src && fonte) v.src = fonte;
            v.play().catch(() => {});
          } else if (!v.paused) {
            v.pause();
          }
        });
      },
      { rootMargin: "200px 0px" }
    );
    loops.forEach((v) => io.observe(v));
  }

  // Link da divisória correspondente à seção na tela.
  const chips = Array.from(root.querySelectorAll<HTMLAnchorElement>("[data-ls-nav]"));
  if ("IntersectionObserver" in window && chips.length) {
    const alvos = chips
      .map((a) => document.querySelector(a.getAttribute("href") || ""))
      .filter((el): el is Element => !!el);
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((en) => {
          if (!en.isIntersecting) return;
          const id = `#${en.target.id}`;
          chips.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === id)));
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    alvos.forEach((el) => io.observe(el));
  }
}
