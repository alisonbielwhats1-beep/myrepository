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

import { formatBRL } from "./utils";

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
 * Faixas de preço divulgadas na landing (seção "Planos"): o valor acompanha a
 * quantidade de alunos ativos, e todas as faixas têm o sistema inteiro.
 *
 * São os valores de vitrine das faixas comerciais da migration 056
 * (`public.faixas_comerciais`), agora públicos por decisão comercial. A
 * landing não lê o banco: se o superadministrador mudar uma faixa no painel,
 * atualize aqui também. Acima da última faixa não há preço de tabela.
 */
export const FAIXAS_PRECO: {
  nome: string;
  alunos_min: number;
  alunos_max: number;
  preco_mensal: number;
  destaque?: boolean;
}[] = [
  { nome: "Start", alunos_min: 0, alunos_max: 200, preco_mensal: 99.9 },
  { nome: "Growth", alunos_min: 201, alunos_max: 350, preco_mensal: 159, destaque: true },
  { nome: "Pro", alunos_min: 351, alunos_max: 500, preco_mensal: 229 },
];

/** Desconto do pagamento anual (12 meses pagos de uma vez), como fração. */
export const DESCONTO_ANUAL = 0.2;

/**
 * Preço comercial de entrada ("Planos a partir de"): a primeira faixa.
 * `lib/planos.ts` (PLANOS_SAAS) guarda o valor técnico usado no painel
 * administrativo interno — este aqui é o valor de vitrine da landing.
 */
export const PRECO_MENSAL_LABEL = formatBRL(FAIXAS_PRECO[0].preco_mensal);
export const PLANO_COMERCIAL_NOME = "GestAcad Premium";
