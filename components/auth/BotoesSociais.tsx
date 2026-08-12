"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { origemPublica } from "@/lib/site-url";
import {
  provedoresHabilitados,
  type ProvedorSocial,
} from "@/lib/auth-config";
import { caminhoInternoSeguro } from "@/lib/redirecionamento";

/**
 * Botões "Continuar com Google/Apple". Renderiza APENAS os provedores
 * habilitados no ambiente (lib/auth-config) — nunca um botão que levaria a
 * erro. Inicia o OAuth do Supabase (PKCE) e volta para /auth/callback, que
 * troca o código por sessão e segue para `next`.
 *
 * `next` é sempre um caminho INTERNO (validado): na ativação é
 * /ativar/continuar (finaliza o vínculo); no login é o destino pós-login.
 */
export default function BotoesSociais({ next = "/painel" }: { next?: string }) {
  const provedores = provedoresHabilitados();
  const [carregando, setCarregando] = useState<ProvedorSocial | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (provedores.length === 0) return null;

  async function entrar(provider: ProvedorSocial) {
    setErro(null);
    setCarregando(provider);
    try {
      const destino = caminhoInternoSeguro(next, "/painel");
      const redirectTo = `${origemPublica()}/auth/callback?next=${encodeURIComponent(
        destino
      )}`;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // Escopos mínimos: só identidade/perfil básico. Sem pedir mais do que
          // o necessário para autenticar (prompt 7.4).
          scopes: provider === "google" ? "email profile" : "email name",
        },
      });
      if (error) {
        setCarregando(null);
        setErro("Não foi possível iniciar o login social. Tente novamente.");
      }
      // Em sucesso o navegador é redirecionado ao provedor — nada mais a fazer.
    } catch {
      setCarregando(null);
      setErro("Não foi possível iniciar o login social. Tente novamente.");
    }
  }

  return (
    <div className="space-y-2.5">
      {erro && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {erro}
        </p>
      )}
      {provedores.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => entrar(p)}
          disabled={carregando !== null}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/[0.07] disabled:opacity-60"
        >
          {carregando === p ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <IconeProvedor provedor={p} />
          )}
          {p === "google" ? "Continuar com Google" : "Continuar com Apple"}
        </button>
      ))}
    </div>
  );
}

function IconeProvedor({ provedor }: { provedor: ProvedorSocial }) {
  if (provedor === "google") {
    // "G" oficial multicolor, embutido como SVG (sem asset externo).
    return (
      <svg className="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
        />
        <path
          fill="#FF3D00"
          d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.2 44 30.6 44 24c0-1.3-.1-2.3-.4-3.5z"
        />
      </svg>
    );
  }
  // Apple: logo monocromático branco.
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.89 2.65 3.24 2.6 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.27 3.14-2.53.99-1.45 1.4-2.86 1.42-2.93-.03-.01-2.72-1.04-2.75-4.13-.01-.01 0-.02.02-.02zM14.56 4.4c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z" />
    </svg>
  );
}
