"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Portal from "@/components/ui/Portal";
import TelaCheiaDescanso, {
  BarraDescanso,
  ControlesDescanso,
} from "./CronometroTelaCheia";

/**
 * Cronômetro de descanso entre séries — um só pra tela inteira de execução.
 *
 * POR QUE UM PROVIDER, E NÃO UM CRONÔMETRO POR CARD (como era antes)
 *   Cada ExercicioCard montava a própria instância. Isso trazia três defeitos
 *   que a tela cheia resolve de uma vez:
 *     1. rolando a lista, o cronômetro saía do campo de visão e o aluno perdia
 *        a hora de voltar pro aparelho;
 *     2. dois descansos podiam correr ao mesmo tempo em cards diferentes;
 *     3. não havia onde pendurar tela-acesa e som sem duplicar por card.
 *   Com o estado aqui em cima, existe no máximo UM descanso, ele sobrevive à
 *   rolagem (vira a barra recolhida) e o overlay sai pelo Portal — obrigatório,
 *   porque `.surface` usa backdrop-blur e prenderia um `fixed inset-0` dentro
 *   do card.
 *
 * A contagem é ancorada num timestamp real (`alvoRef`), não numa soma de ticks:
 * se a aba vai para segundo plano e o `setInterval` é estrangulado, ao voltar o
 * tempo restante ainda está correto — o relógio de parede não mente.
 *
 * Nada disso vai ao banco: é ferramenta de execução, 100% client-side.
 */

type PedidoDescanso = {
  segundos: number;
  exercicio: string;
  /** Prescrição em texto curto (ex: "3 × 12 · 30 kg"). */
  detalhe?: string | null;
  /** Nome do próximo exercício da ficha. */
  proximo?: string | null;
};

type ContextoDescanso = {
  iniciar: (pedido: PedidoDescanso) => void;
};

const Ctx = createContext<ContextoDescanso | null>(null);

/**
 * Devolve null fora do provider — é o caso da ficha pública read-only
 * (`app/treino/[token]`), que renderiza ExercicioCard sem sessão. O card só
 * mostra o botão de descanso quando isto existe.
 */
export function useDescanso() {
  return useContext(Ctx);
}

const CHAVE_MUDO = "gestacad:descanso-mudo";
const PADRAO_SEGUNDOS = 60;

export default function ProvedorDescanso({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sessao, setSessao] = useState<PedidoDescanso | null>(null);
  const [restante, setRestante] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [terminou, setTerminou] = useState(false);
  const [minimizado, setMinimizado] = useState(false);
  const [mudo, setMudo] = useState(false);

  const alvoRef = useRef(0); // timestamp (ms) em que a contagem zera
  const ultimoBipRef = useRef(0); // último segundo já bipado (evita repetir no tick)
  const fimRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const mudoRef = useRef(false);

  // Preferência de som — padrão ligado. Lida no cliente pra não quebrar o SSR.
  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_MUDO);
      if (salvo === "1") {
        setMudo(true);
        mudoRef.current = true;
      }
    } catch {
      /* localStorage bloqueado (modo privado): segue com o padrão. */
    }
  }, []);

  // --- Som -----------------------------------------------------------------
  // Oscilador do WebAudio: bipe sem baixar nenhum asset. O AudioContext nasce
  // dentro do clique que inicia o descanso, então o gesto do usuário já o
  // libera — é isso que faz o som funcionar onde o autoplay é bloqueado.
  const bip = useCallback((freq: number, dur: number, atraso = 0) => {
    if (mudoRef.current) return;
    const ctx = audioRef.current;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") void ctx.resume();
      const t0 = ctx.currentTime + atraso;
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      // Rampas exponenciais: sem elas o corte seco estala no alto-falante.
      ganho.gain.setValueAtTime(0.0001, t0);
      ganho.gain.exponentialRampToValueAtTime(0.3, t0 + 0.012);
      ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(ganho);
      ganho.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      /* Áudio é enfeite: nunca pode derrubar a contagem. */
    }
  }, []);

  const encerrar = useCallback(() => {
    if (fimRef.current != null) {
      window.clearTimeout(fimRef.current);
      fimRef.current = null;
    }
    setSessao(null);
    setTerminou(false);
    setPausado(false);
    setMinimizado(false);
    setRestante(0);
  }, []);

  const iniciar = useCallback(
    (pedido: PedidoDescanso) => {
      const base = pedido.segundos > 0 ? pedido.segundos : PADRAO_SEGUNDOS;
      // Criado/retomado aqui dentro porque `iniciar` só é chamado a partir de
      // um toque do aluno — o gesto que destrava o áudio no navegador.
      try {
        const AC =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (AC) {
          audioRef.current ??= new AC();
          if (audioRef.current.state === "suspended") void audioRef.current.resume();
        }
      } catch {
        /* Sem áudio: a vibração e o visual continuam valendo. */
      }
      if (fimRef.current != null) {
        window.clearTimeout(fimRef.current);
        fimRef.current = null;
      }
      alvoRef.current = Date.now() + base * 1000;
      ultimoBipRef.current = 0;
      setSessao({ ...pedido, segundos: base });
      setRestante(base);
      setTerminou(false);
      setPausado(false);
      setMinimizado(false); // marcar a série abre em tela cheia
    },
    []
  );

  // --- Contagem ------------------------------------------------------------
  useEffect(() => {
    if (!sessao || pausado || terminou) return;

    const tick = () => {
      const seg = Math.max(0, Math.round((alvoRef.current - Date.now()) / 1000));
      setRestante(seg);

      if (seg > 0 && seg <= 3 && ultimoBipRef.current !== seg) {
        ultimoBipRef.current = seg;
        bip(880, 0.11);
      }

      if (seg <= 0) {
        setTerminou(true);
        navigator.vibrate?.([120, 60, 120]);
        bip(1046, 0.16);
        bip(1318, 0.28, 0.18);
        fimRef.current = window.setTimeout(encerrar, 2600);
      }
    };

    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [sessao, pausado, terminou, bip, encerrar]);

  // --- Tela acesa ----------------------------------------------------------
  // Sem isto o celular apaga no meio do descanso e o aluno só descobre ao
  // desbloquear. O bloqueio é solto pelo próprio navegador quando a aba some,
  // por isso o pedido é refeito ao voltar.
  useEffect(() => {
    if (!sessao) return;
    let cancelado = false;
    let sentinela: WakeLockSentinel | null = null;

    const pedir = async () => {
      try {
        const wl = navigator.wakeLock;
        if (!wl || document.visibilityState !== "visible") return;
        const s = await wl.request("screen");
        if (cancelado) {
          void s.release();
          return;
        }
        sentinela = s;
      } catch {
        /* Sem suporte ou negado: o cronômetro continua igual. */
      }
    };

    void pedir();
    const aoVoltar = () => {
      if (document.visibilityState === "visible" && !sentinela) void pedir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      void sentinela?.release();
      sentinela = null;
    };
  }, [sessao]);

  // Trava a rolagem do fundo enquanto o overlay cobre a tela.
  const emTelaCheia = Boolean(sessao) && !minimizado;
  useEffect(() => {
    if (!emTelaCheia) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMinimizado(true);
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [emTelaCheia]);

  useEffect(() => {
    return () => {
      if (fimRef.current != null) window.clearTimeout(fimRef.current);
      void audioRef.current?.close();
    };
  }, []);

  const alternarPausa = useCallback(() => {
    setPausado((p) => {
      // Ao retomar, o alvo é reancorado a partir do que sobrou: pausa não pode
      // "adiantar" o relógio.
      if (p) alvoRef.current = Date.now() + restante * 1000;
      return !p;
    });
  }, [restante]);

  const somar = useCallback(
    (segundos: number) => {
      if (terminou) return;
      const novo = Math.max(5, restante + segundos);
      alvoRef.current = Date.now() + novo * 1000;
      ultimoBipRef.current = 0; // deixa a contagem final bipar de novo
      setRestante(novo);
    },
    [restante, terminou]
  );

  const alternarMudo = useCallback(() => {
    setMudo((m) => {
      const novo = !m;
      mudoRef.current = novo;
      try {
        window.localStorage.setItem(CHAVE_MUDO, novo ? "1" : "0");
      } catch {
        /* Preferência não persiste; a sessão atual respeita mesmo assim. */
      }
      return novo;
    });
  }, []);

  const valor = useMemo<ContextoDescanso>(() => ({ iniciar }), [iniciar]);

  const controles: ControlesDescanso | null = sessao && {
    exercicio: sessao.exercicio,
    detalhe: sessao.detalhe,
    proximo: sessao.proximo,
    restante,
    base: sessao.segundos,
    pausado,
    terminou,
    mudo,
    alternarPausa,
    somar,
    alternarMudo,
    minimizar: () => setMinimizado(true),
    expandir: () => setMinimizado(false),
    encerrar,
  };

  return (
    <Ctx.Provider value={valor}>
      {children}
      {controles && (
        <Portal>
          {minimizado ? (
            <BarraDescanso {...controles} />
          ) : (
            <TelaCheiaDescanso {...controles} />
          )}
        </Portal>
      )}
    </Ctx.Provider>
  );
}
