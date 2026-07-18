"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

/**
 * Botão "Instalar app" que aparece só quando o navegador permite instalar o
 * PWA (evento beforeinstallprompt). Some depois de instalado.
 */
export default function InstallPWA() {
  const [prompt, setPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setPrompt(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!prompt) return null;

  const instalar = async () => {
    // @ts-expect-error prompt() existe no BeforeInstallPromptEvent
    prompt.prompt();
    setPrompt(null);
  };

  return (
    <button onClick={instalar} className="btn-ghost !py-2" title="Instalar como aplicativo">
      <Download className="h-4 w-4" /> Instalar app
    </button>
  );
}
