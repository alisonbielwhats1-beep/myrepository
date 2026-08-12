"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, Plus, X, MoreVertical } from "lucide-react";
import { ehIOS, estaInstalado, LS_INSTALL_DISPENSADO } from "@/lib/aluno-dispositivo";

/**
 * Botão "Adicionar à tela inicial" na área do aluno — pensado para cliente
 * inexperiente: um toque resolve na maioria dos casos.
 *
 *   - Android/desktop: o toque dispara o instalador nativo (beforeinstallprompt)
 *     — o aluno só confirma. Vira app em tela cheia.
 *   - iPhone/iPad: a Apple não deixa nenhum site instalar sozinho, então o toque
 *     abre um guia com o passo a passo (Compartilhar → Adicionar à Tela de
 *     Início). É o melhor possível no iOS.
 *   - some quando o app já está instalado ou o aluno dispensa (guardado no
 *     aparelho, para não insistir).
 */
export default function InstalarAppAluno() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [oculto, setOculto] = useState(true); // começa oculto até decidir
  const [guia, setGuia] = useState(false);
  const ios = useRef(false);

  useEffect(() => {
    if (estaInstalado()) return;
    try {
      if (localStorage.getItem(LS_INSTALL_DISPENSADO) === "1") return;
    } catch {
      // sem storage: segue mostrando
    }
    ios.current = ehIOS();
    setOculto(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setOculto(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dispensar = () => {
    setOculto(true);
    try {
      localStorage.setItem(LS_INSTALL_DISPENSADO, "1");
    } catch {
      // ignora
    }
  };

  const aoClicar = async () => {
    // Android/desktop com instalador pronto: um toque instala.
    if (prompt) {
      // @ts-expect-error prompt() existe no BeforeInstallPromptEvent
      prompt.prompt();
      try {
        // @ts-expect-error userChoice existe no BeforeInstallPromptEvent
        await prompt.userChoice;
      } catch {
        // ignora
      }
      setPrompt(null);
      setOculto(true);
      return;
    }
    // iPhone (ou Android antes do instalador ficar pronto): mostra o guia.
    setGuia(true);
  };

  if (oculto) return null;

  return (
    <>
      <div className="relative mx-auto mb-3 max-w-md rounded-2xl border border-volt-500/25 bg-volt-500/[0.06] p-3 pr-9">
        <button
          onClick={dispensar}
          aria-label="Dispensar"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="mb-2 text-sm text-slate-200">
          Deixe o app na tela inicial do celular para abrir seus treinos com um toque.
        </p>
        <button
          onClick={aoClicar}
          className="btn-volt flex w-full items-center justify-center gap-2 !py-2.5"
        >
          <Download className="h-4 w-4" />
          Adicionar à tela inicial
        </button>
      </div>

      {guia && <GuiaInstalacao ios={ios.current} onClose={() => setGuia(false)} />}
    </>
  );
}

/** Passo a passo em tela cheia, para quando não dá o instalador de um toque. */
function GuiaInstalacao({ ios, onClose }: { ios: boolean; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-volt-500/25 bg-ink-950 p-5 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Adicionar à tela inicial</h2>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {ios ? (
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Passo n={1} />
              <span>
                Toque no botão <strong>Compartilhar</strong>{" "}
                <Share className="inline h-4 w-4 text-volt-300" /> na barra de baixo do Safari.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Passo n={2} />
              <span>
                Role e toque em <strong>Adicionar à Tela de Início</strong>{" "}
                <Plus className="inline h-4 w-4 text-volt-300" />.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Passo n={3} />
              <span>
                Toque em <strong>Adicionar</strong>, no canto superior direito. Pronto!
              </span>
            </li>
          </ol>
        ) : (
          <ol className="space-y-3 text-sm">
            <li className="flex items-start gap-3">
              <Passo n={1} />
              <span>
                Toque no menu <MoreVertical className="inline h-4 w-4 text-volt-300" /> do
                Chrome (três pontinhos, no canto de cima).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Passo n={2} />
              <span>
                Toque em <strong>Adicionar à tela inicial</strong> (ou{" "}
                <strong>Instalar app</strong>).
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Passo n={3} />
              <span>
                Confirme em <strong>Adicionar</strong>. Pronto!
              </span>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}

function Passo({ n }: { n: number }) {
  return (
    <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-volt-500 text-xs font-bold text-ink-950">
      {n}
    </span>
  );
}
