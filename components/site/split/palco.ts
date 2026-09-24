import { EVENTOS, FICHA, JANELA_MONTAGEM, JANELA_SERIES, LEGENDAS } from "./demo";

/**
 * Coreografia própria da landing em tela dividida. O engine (scrollcraft)
 * pina os atos e publica `--sc-p` em cada um; este arquivo só LÊ esse valor e
 * decide o que ele significa aqui:
 *
 * - o sinal que atravessa a divisória no ato "Conexão" e a marca que cada
 *   travessia deixa na divisória;
 * - a divisória partida enquanto o ato "Sem sistema" está na tela;
 * - o colapso do fechamento (a divisória corre para a borda);
 * - os cartões do app sobre os vídeos do ato "Conexão";
 * - os vídeos em loop, que só carregam perto da tela.
 *
 * Tudo é derivado do scroll a cada quadro, então rolar para cima desfaz os
 * eventos na mesma ordem. Nada aqui altera o engine.
 */

type Estado = "antes" | "viajando" | "chegou";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function progresso(el: Element | null): number {
  if (!el) return 0;
  const v = parseFloat((el as HTMLElement).style.getPropertyValue("--sc-p"));
  return Number.isFinite(v) ? v : 0;
}

function centro(el: Element, base: DOMRect) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top };
}

export function iniciarPalco(root: HTMLElement) {
  const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = matchMedia("(min-width: 1024px)");
  const ponteiroFino = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const atoSem = root.querySelector("#problemas");
  const atoCon = root.querySelector("#painel");
  const palcoCon = atoCon?.querySelector<HTMLElement>("[data-sc-stage], .sc-stage") ?? null;
  const atoFim = root.querySelector("#planos");
  const hero = root.querySelector<HTMLElement>(".ls-hero");

  const sinais = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>(".ls-sinal").forEach((el) => sinais.set(el.dataset.ev!, el));
  const marcas = new Map<string, HTMLElement>();
  root.querySelectorAll<HTMLElement>(".ls-marca").forEach((el) => marcas.set(el.dataset.ev!, el));
  const legendas = Array.from(root.querySelectorAll<HTMLElement>(".ls-legendas p"));

  const estados: Record<string, Estado> = {};
  let legendaAtual = -2;
  let seriesAtual = -1;
  let cartaoAAtual = "";
  let cartaoBAtual = "";
  let montagemAtual = -1;
  let linhaAtual = "";

  function medirLargura() {
    root.style.setProperty("--ls-vw", `${document.documentElement.clientWidth}px`);
  }
  medirLargura();
  addEventListener("resize", medirLargura, { passive: true });

  function atualizarConexao() {
    const p = progresso(atoCon);
    const base = palcoCon?.getBoundingClientRect();
    const visivel = !!base && base.bottom > 0 && base.top < innerHeight;

    EVENTOS.forEach((ev) => {
      const [ini, fim] = ev.janela;
      const t = clamp((p - ini) / (fim - ini));
      const estado: Estado = t <= 0 ? "antes" : t >= 1 ? "chegou" : "viajando";
      if (estados[ev.id] !== estado) {
        estados[ev.id] = estado;
        if (estado === "antes") root.removeAttribute(`data-ev-${ev.id}`);
        else root.setAttribute(`data-ev-${ev.id}`, estado);
        marcas.get(ev.id)?.classList.toggle("is-on", estado === "chegou");
      }

      const sinal = sinais.get(ev.id);
      if (!sinal) return;
      if (estado !== "viajando" || !visivel || reduzido || !base) {
        if (sinal.style.opacity !== "0") sinal.style.opacity = "0";
        return;
      }
      const de = document.getElementById(ev.de);
      const para = document.getElementById(ev.para);
      if (!de || !para) return;
      const a = centro(de, base);
      const b = centro(para, base);
      // A marca fica na altura em que este sinal cruza a divisória. Medida
      // durante a viagem porque origem e destino podem estar ocultos antes.
      // Se outra marca já está nessa altura, desce a nova para não sobrepor.
      let yMarca = Math.round(base.top + (a.y + b.y) / 2);
      marcas.forEach((m, id) => {
        if (id === ev.id || !m.classList.contains("is-on")) return;
        const outra = parseFloat(m.style.getPropertyValue("--y"));
        if (Math.abs(outra - yMarca) < 18) yMarca = outra + 18;
      });
      marcas.get(ev.id)?.style.setProperty("--y", `${yMarca}px`);
      const e = suave(t);
      const x = a.x + (b.x - a.x) * e;
      const y = a.y + (b.y - a.y) * e;
      sinal.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      // Entra e sai pelas pontas para não "brotar" em cima do elemento.
      sinal.style.opacity = String(clamp(Math.min(t / 0.12, (1 - t) / 0.12)));
    });

    // Cartões: um por vez de cada lado. O destino de um sinal já está no
    // lugar (invisível) enquanto ele viaja, e aparece quando o sinal chega.
    const pagaInicio = EVENTOS[2].janela[0] - 0.04;
    const cartaoA =
      p >= pagaInicio ? "pagamento" : estados.treino === "chegou" ? "adesao" : "montagem";
    const cartaoB =
      estados.mensalidade === "chegou"
        ? "mensalidade"
        : p >= JANELA_SERIES[0]
          ? "series"
          : estados.ficha === "chegou"
            ? "ficha"
            : "nenhum";
    if (cartaoA !== cartaoAAtual) {
      cartaoAAtual = cartaoA;
      root.setAttribute("data-ls-cartao-a", cartaoA);
    }
    if (cartaoB !== cartaoBAtual) {
      cartaoBAtual = cartaoB;
      root.setAttribute("data-ls-cartao-b", cartaoB);
    }
    const tm = clamp((p - JANELA_MONTAGEM[0]) / (JANELA_MONTAGEM[1] - JANELA_MONTAGEM[0]));
    const montagem = Math.round(tm * FICHA.length);
    if (montagem !== montagemAtual) {
      montagemAtual = montagem;
      root.setAttribute("data-ls-montagem", String(montagem));
    }

    // Séries: os três exercícios que faltam são marcados um a um dentro da
    // janela; o quarto passo é o botão "Finalizar treino".
    const ts = clamp((p - JANELA_SERIES[0]) / (JANELA_SERIES[1] - JANELA_SERIES[0]));
    const series = Math.min(3, Math.floor(ts * 3.999));
    if (series !== seriesAtual) {
      seriesAtual = series;
      root.setAttribute("data-ls-series", String(series));
    }

    // Legenda da vez: a do momento mais recente que já começou. Antes do
    // primeiro, nenhuma (o título do ato carrega a tela).
    let idx = -1;
    LEGENDAS.forEach((l, i) => {
      if (p >= l.inicio - 0.04) idx = i;
    });
    if (idx !== legendaAtual) {
      legendaAtual = idx;
      legendas.forEach((el) => el.classList.toggle("is-on", Number(el.dataset.leg) === idx));
    }
  }

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
    atualizarConexao();
    atualizarLinha();
    atualizarFechamento();
    if (hero && Math.abs(mxAlvo - mx) > 0.001) {
      mx += (mxAlvo - mx) * 0.08;
      hero.style.setProperty("--ls-mx", mx.toFixed(4));
    }
    requestAnimationFrame(quadro);
  }

  requestAnimationFrame(quadro);

  // Loops do ato "Recursos": fonte só perto da tela, pausa fora dela, e sob
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
