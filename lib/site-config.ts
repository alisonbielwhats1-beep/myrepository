/**
 * Configuração COMERCIAL da página pública (landing page).
 *
 * Nada aqui é inventado: o WhatsApp comercial do GestAcad não existia em
 * lugar nenhum do projeto (a coluna `academias.whatsapp` é o contato de CADA
 * academia cliente, não o nosso canal de vendas). Em vez de escrever um
 * número fictício, a configuração fica centralizada nesta variável de
 * ambiente — enquanto ela não for preenchida, os botões de WhatsApp
 * simplesmente não aparecem e a landing explica como entrar em contato.
 */

/** Número comercial do GestAcad, só dígitos com DDI (ex.: 5511999999999). */
export const WHATSAPP_COMERCIAL =
  process.env.NEXT_PUBLIC_WHATSAPP_COMERCIAL?.replace(/\D/g, "") || null;

/** Mensagem inicial do clique-para-conversar (definida no prompt comercial). */
export const MENSAGEM_WHATSAPP_COMERCIAL =
  "Olá! Quero conhecer o GestAcad e entender como ele pode ajudar na gestão da minha academia.";

/**
 * Link wa.me pronto — `null` quando não há número configurado. Quem consome
 * DEVE tratar o null escondendo o botão, nunca caindo num número padrão.
 */
export const linkWhatsappComercial = WHATSAPP_COMERCIAL
  ? `https://wa.me/${WHATSAPP_COMERCIAL}?text=${encodeURIComponent(
      MENSAGEM_WHATSAPP_COMERCIAL
    )}`
  : null;

/**
 * Preço comercial confirmado do plano oferecido às academias.
 * `lib/planos.ts` (PLANOS_SAAS) guarda o valor técnico usado no painel
 * administrativo interno — este aqui é o valor de vitrine, confirmado
 * explicitamente para a landing page.
 */
export const PRECO_MENSAL_LABEL = "R$ 99,90";
export const PLANO_COMERCIAL_NOME = "GestAcad Premium";
