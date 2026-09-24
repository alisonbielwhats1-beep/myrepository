"use client";

import { useEffect, useRef } from "react";

/**
 * Cena guiada por scroll da landing. A seção tem `span` alturas de tela e o
 * palco (`.lp-stage`) fica preso no topo enquanto ela passa. O progresso
 * (0 a 1) vai para a variável CSS `--p` da seção, e é o CSS quem anima tudo a
 * partir dela: nenhuma re-renderização do React a cada quadro.
 *
 * - `steps`: limiares de progresso; a seção recebe `data-step` com quantos
 *   já foram passados (estados discretos, ex.: o painel "reagindo").
 * - `pan`: mede o trilho `[data-rail]` e publica `--travel` (px) para a
 *   rolagem lateral percorrer exatamente o que sobra da largura.
 *
 * Com "reduzir movimento", o CSS desfaz o pin e a altura extra, e aqui o
 * progresso fica parado no estado final (1), onde o conteúdo está completo.
 */
export default function ScrollScene({
  id,
  span,
  spanMobile,
  steps,
  pan = false,
  className = "",
  stageClassName = "",
  label,
  fora,
  children,
}: {
  id?: string;
  span: number;
  spanMobile?: number;
  steps?: number[];
  pan?: boolean;
  className?: string;
  stageClassName?: string;
  label?: string;
  /** Conteúdo fora do palco preso (ex.: âncoras posicionadas ao longo da cena). */
  fora?: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visivel = true;
    let ultimoP = -1;
    let ultimoStep = -1;

    const medirTrilho = () => {
      if (!pan) return;
      const trilho = el.querySelector<HTMLElement>("[data-rail]");
      if (!trilho) return;
      const sobra = Math.max(0, trilho.scrollWidth - el.clientWidth);
      el.style.setProperty("--travel", `${sobra}px`);
    };

    const aplicar = () => {
      frame = 0;
      let p = 1;
      if (!reduzido.matches) {
        const r = el.getBoundingClientRect();
        const percurso = Math.max(1, r.height - window.innerHeight);
        p = Math.min(1, Math.max(0, -r.top / percurso));
      }
      if (Math.abs(p - ultimoP) > 0.0005) {
        ultimoP = p;
        el.style.setProperty("--p", p.toFixed(4));
      }
      if (steps) {
        const step = steps.filter((s) => p >= s).length;
        if (step !== ultimoStep) {
          ultimoStep = step;
          el.dataset.step = String(step);
          // Numérico para o CSS: opacity: clamp(0, var(--step) - (n - 1), 1)
          // acende um elemento a partir do passo n.
          el.style.setProperty("--step", String(step));
        }
      }
    };

    const agendar = () => {
      if (!visivel || frame) return;
      frame = requestAnimationFrame(aplicar);
    };

    const aoRedimensionar = () => {
      medirTrilho();
      agendar();
    };

    // Só trabalha quando a cena está perto da tela.
    const io = new IntersectionObserver(
      ([entrada]) => {
        visivel = entrada.isIntersecting;
        if (visivel) agendar();
      },
      { rootMargin: "50% 0px" }
    );
    io.observe(el);

    medirTrilho();
    aplicar();
    el.dataset.ready = "1";

    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", aoRedimensionar);
    reduzido.addEventListener("change", aoRedimensionar);
    // Fontes e imagens mudam a largura do trilho depois da primeira medida.
    const ro = new ResizeObserver(aoRedimensionar);
    const trilho = el.querySelector("[data-rail]");
    if (trilho) ro.observe(trilho);

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", aoRedimensionar);
      reduzido.removeEventListener("change", aoRedimensionar);
    };
  }, [pan, steps]);

  const estilo = {
    "--span": span,
    "--span-m": spanMobile ?? span,
    "--p": 0,
    "--step": 0,
  } as React.CSSProperties;

  return (
    <section
      ref={ref}
      id={id}
      aria-label={label}
      className={`lp-scene ${className}`}
      style={estilo}
      data-step="0"
    >
      {fora}
      <div className={`lp-stage ${stageClassName}`}>{children}</div>
    </section>
  );
}
