"use client";

import { useEffect } from "react";

/**
 * Efeitos pequenos da landing, num único componente client para não espalhar
 * ilhas de JavaScript pela página:
 *
 * - revelação: todo `[data-reveal]` ganha `data-in` ao entrar na tela (uma vez);
 * - ponteiro: todo `[data-tilt]` recebe `--mx`/`--my` (-1 a 1) conforme o
 *   mouse, só em dispositivos com mouse de verdade e sem "reduzir movimento".
 *
 * Sem JavaScript, o CSS mostra tudo no estado final (nada fica escondido).
 */
export default function LandingEfeitos() {
  useEffect(() => {
    document.documentElement.classList.add("lp-js");

    const alvos = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).dataset.in = "1";
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
    );
    alvos.forEach((a) => io.observe(a));

    const mouseFino = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)"
    );
    const inclinaveis = Array.from(
      document.querySelectorAll<HTMLElement>("[data-tilt]")
    );
    let frame = 0;
    let ultimo: PointerEvent | null = null;
    const aplicar = () => {
      frame = 0;
      if (!ultimo) return;
      for (const el of inclinaveis) {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        const mx = ((ultimo.clientX - (r.left + r.width / 2)) / (r.width / 2)) || 0;
        const my = ((ultimo.clientY - (r.top + r.height / 2)) / (r.height / 2)) || 0;
        el.style.setProperty("--mx", Math.max(-1, Math.min(1, mx)).toFixed(3));
        el.style.setProperty("--my", Math.max(-1, Math.min(1, my)).toFixed(3));
      }
    };
    const aoMover = (e: PointerEvent) => {
      if (!mouseFino.matches || e.pointerType !== "mouse") return;
      ultimo = e;
      if (!frame) frame = requestAnimationFrame(aplicar);
    };
    if (inclinaveis.length) {
      window.addEventListener("pointermove", aoMover, { passive: true });
    }

    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", aoMover);
      document.documentElement.classList.remove("lp-js");
    };
  }, []);

  return null;
}
