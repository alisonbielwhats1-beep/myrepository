/**
 * Monta um link "click-to-chat" do WhatsApp (wa.me) com mensagem pré-escrita.
 * Normaliza o telefone: só dígitos, com DDI do Brasil (55) quando ausente.
 * Retorna null se o telefone não for utilizável.
 */
export function linkWhats(
  telefone: string | null | undefined,
  texto: string
): string | null {
  const digits = (telefone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null; // telefone incompleto

  // Se já veio com DDI (13 díg. com 55, ou 12), usa como está; senão prefixa 55.
  const comDDI = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;

  return `https://wa.me/${comDDI}?text=${encodeURIComponent(texto)}`;
}

/** Mensagem padrão de lembrete/cobrança de mensalidade. */
export function mensagemCobranca(opts: {
  nome: string;
  academia: string;
  valor: string;
  data: string; // já formatada (dd/mm/aaaa)
  vencida: boolean;
}): string {
  const primeiroNome = opts.nome.split(" ")[0];
  if (opts.vencida) {
    return (
      `Olá, ${primeiroNome}! 👋 Tudo bem?\n\n` +
      `Passando para avisar que sua mensalidade da ${opts.academia}, no valor de ${opts.valor}, ` +
      `venceu em ${opts.data} e consta em aberto. Consegue regularizar?\n\n` +
      `Qualquer dúvida, estou à disposição. 💪`
    );
  }
  return (
    `Olá, ${primeiroNome}! 👋 Tudo bem?\n\n` +
    `Passando para lembrar que sua mensalidade da ${opts.academia}, no valor de ${opts.valor}, ` +
    `vence em ${opts.data}.\n\n` +
    `Qualquer dúvida, estou à disposição. 💪`
  );
}
