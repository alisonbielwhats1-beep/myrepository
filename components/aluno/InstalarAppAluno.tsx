"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import {
  ehIOS,
  estaInstalado,
  LS_INSTALL_DISPENSADO,
} from "@/lib/aluno-dispositivo";

/**
 * Convite para instalar o app na área do aluno. Não intrusivo e dispensável:
 *   - Android/desktop: usa o prompt nativo (beforeinstallprompt);
 *   - iPhone/iPad: mostra o passo a passo (Compartilhar → Adicionar à Tela de
 *     Início), já que o iOS não expõe prompt automático;
 *   - some quando o app já está instalado (standalone) ou o aluno dispensa
 *     (guardado no aparelho, para não insistir).
 */
export default function InstalarAppAluno() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [mostrarIOS, setMostrarIOS] = useState(false);
  const [dispensado, setDispensado] = useState(true); // começa oculto até decidir

  useEffect(() => {
    if (estaInstalado()) return;
    try {
      if (localStorage.getItem(LS_INSTALL_DISPENSADO) === "1") return;
    } catch {
      // sem storage: segue mostrando
    }
    setDispensado(false);

    if (ehIOS()) {
      setMostrarIOS(true);
      return;
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setPrompt(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dispensar = () => {
    setDispensado(true);
    try {
      localStorage.setItem(LS_INSTALL_DISPENSADO, "1");
    } catch {
      // ignora
    }
  };

  const instalar = async () => {
    if (!prompt) return;
    // @ts-expect-error prompt() existe no BeforeInstallPromptEvent
    prompt.prompt();
    setPrompt(null);
    dispensar();
  };

  if (dispensado) return null;
  // Android/desktop sem prompt disponível e não-iOS: nada a mostrar.
  if (!mostrarIOS && !prompt) return null;

  return (
    <div className="relative mx-auto mb-3 max-w-md rounded-2xl border border-volt-500/25 bg-volt-500/[0.06] p-3 pr-9 text-sm text-slate-200">
      <button
        onClick={dispensar}
        aria-label="Dispensar"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>

      {mostrarIOS ? (
        <div className="flex items-start gap-2">
          <Share className="mt-0.5 h-4 w-4 flex-none text-volt-300" />
          <span>
            Para instalar o app: toque em <strong>Compartilhar</strong>{" "}
            <Share className="inline h-3.5 w-3.5" /> e depois em{" "}
            <strong>Adicionar à Tela de Início</strong>{" "}
            <Plus className="inline h-3.5 w-3.5" />.
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Download className="h-4 w-4 flex-none text-volt-300" />
            Instale o app na tela inicial para abrir mais rápido.
          </span>
          <button onClick={instalar} className="btn-volt !py-1.5 text-xs flex-none">
            Instalar
          </button>
        </div>
      )}
    </div>
  );
}
