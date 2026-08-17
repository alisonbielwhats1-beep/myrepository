"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  PAGINA_NOVA_SENHA,
  PAGINA_PEDIR_LINK,
  analisarRetornoRecuperacao,
  precisaIrParaNovaSenha,
} from "@/lib/recuperacao-senha";

/**
 * Rede de segurança do fluxo "Esqueci minha senha", montada no layout raiz.
 *
 * O link do e-mail deveria cair em `/auth/recuperar`, mas o Supabase só honra
 * esse destino se ele estiver na allow-list de Redirect URLs do projeto —
 * qualquer divergência (domínio novo, preview da Vercel, entrada faltando) faz
 * o usuário cair no Site URL, ou seja, na tela inicial, e o formulário de nova
 * senha nunca aparece. Este componente elimina essa dependência: se o retorno
 * de recuperação chegar em QUALQUER página, ele estabelece a sessão e leva a
 * pessoa para a tela certa.
 *
 * Só age quando a URL tem marca de recuperação (`code`, `token_hash`,
 * `access_token` no fragmento ou `error`); em navegação normal é um no-op — e
 * como lê `window.location` dentro do efeito (não `useSearchParams`), não força
 * renderização dinâmica das páginas estáticas.
 */
export default function GateRecuperacaoSenha() {
  const router = useRouter();

  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const acao = analisarRetornoRecuperacao({ pathname, search, hash });
    if (acao.tipo === "ignorar") return;

    let cancelado = false;

    /** Remove token/erro da URL para não ficarem no histórico nem em prints. */
    const limparUrl = () => {
      window.history.replaceState(null, "", pathname);
    };

    const irParaNovaSenha = () => {
      if (cancelado) return;
      limparUrl();
      if (precisaIrParaNovaSenha(pathname)) {
        router.replace(PAGINA_NOVA_SENHA);
      } else {
        // Já está na tela certa: só recarrega para o servidor ver a sessão.
        router.refresh();
      }
    };

    const irParaPedirLink = (mensagem: string) => {
      if (cancelado) return;
      limparUrl();
      router.replace(
        `${PAGINA_PEDIR_LINK}?aviso=${encodeURIComponent(mensagem)}`
      );
    };

    (async () => {
      if (acao.tipo === "erro") {
        irParaPedirLink(acao.mensagem);
        return;
      }

      const supabase = createClient();

      if (acao.tipo === "sessao_no_fragmento") {
        // `detectSessionInUrl` (padrão do createBrowserClient) já consumiu o
        // fragmento; basta confirmar que a sessão existe antes de navegar.
        const { data } = await supabase.auth.getSession();
        if (data.session) irParaNovaSenha();
        else
          irParaPedirLink(
            "Não foi possível validar esse link. Peça um novo abaixo."
          );
        return;
      }

      if (acao.tipo === "verificar_token") {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: acao.tokenHash,
        });
        if (error)
          irParaPedirLink(
            "Esse link de recuperação expirou ou já foi usado. Peça um novo abaixo."
          );
        else irParaNovaSenha();
        return;
      }

      if (acao.tipo === "trocar_code") {
        const { error } = await supabase.auth.exchangeCodeForSession(acao.code);
        if (error) {
          // Falha típica de abrir o e-mail em outro navegador: o verificador
          // PKCE ficou no aparelho onde o link foi pedido.
          irParaPedirLink(
            "Abra o link no mesmo navegador em que pediu a recuperação, ou peça um novo abaixo."
          );
        } else {
          irParaNovaSenha();
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complementar: o SDK emite PASSWORD_RECOVERY quando reconhece a sessão de
  // recuperação sozinho (ex.: fragmento consumido antes deste efeito rodar).
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((evento) => {
      if (
        evento === "PASSWORD_RECOVERY" &&
        precisaIrParaNovaSenha(window.location.pathname)
      ) {
        router.replace(PAGINA_NOVA_SENHA);
      }
    });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
