/**
 * Monta um link "click-to-chat" do WhatsApp (wa.me) com mensagem pré-escrita.
 * Normaliza o telefone: só dígitos, com DDI do Brasil (55) quando ausente.
 * Retorna null se o telefone não for utilizável OU se o tenant for demonstração.
 * A verificação de isDemo aqui é defesa em profundidade — o componente que
 * chama esta função deve também bloquear a renderização quando isDemo=true.
 */
export function linkWhats(
  telefone: string | null | undefined,
  texto: string,
  { isDemo = false }: { isDemo?: boolean } = {}
): string | null {
  if (isDemo) return null; // bloqueio de camada de função

  const digits = (telefone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null; // telefone incompleto

  // Se já veio com DDI (13 díg. com 55, ou 12), usa como está; senão prefixa 55.
  const comDDI = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;

  return `https://wa.me/${comDDI}?text=${encodeURIComponent(texto)}`;
}

/**
 * Mensagem com o link pessoal de acesso do aluno.
 *
 * Diz "apresentar seu QR Code na recepção" — e não "catraca" — porque é isso
 * que o sistema realmente faz desde o Bloco 1: a entrada é confirmada por um
 * membro da equipe no painel, não liberada automaticamente por hardware.
 */
export function mensagemAcesso(opts: {
  nome: string;
  academia: string;
  url: string;
}): string {
  const primeiroNome = opts.nome.split(" ")[0];
  return (
    `Olá, ${primeiroNome}! Seu acesso ao aplicativo da ${opts.academia} está pronto. ` +
    `Pelo link abaixo você pode consultar seus treinos, mensalidades, frequência e ` +
    `apresentar seu QR Code na recepção: ${opts.url}\n\n` +
    `Este link é pessoal. Não compartilhe com outras pessoas.`
  );
}

/**
 * Convite de acesso ao painel para um membro da equipe (Fase de 11/08/2026).
 *
 * NÃO carrega senha, de propósito. A pessoa define a própria no primeiro
 * acesso, pelo "Esqueci minha senha" — assim ninguém, nem a dona da academia,
 * precisa saber a senha de outra pessoa. É o que mantém o log de auditoria
 * confiável: cada ação registrada pertence de fato a quem estava logado.
 *
 * `papel` entra na mensagem porque define o que a pessoa vai encontrar lá
 * dentro: um instrutor que abre esperando o financeiro não vai achar.
 */
export function mensagemConviteEquipe(opts: {
  nome: string;
  academia: string;
  papel: string;
  url: string;
}): string {
  const primeiroNome = opts.nome.split(" ")[0];
  return (
    `Olá, ${primeiroNome}! Seu acesso ao painel da ${opts.academia} está criado, ` +
    `com o perfil de ${opts.papel}.\n\n` +
    `1. Abra: ${opts.url}\n` +
    `2. Clique em "Esqueci minha senha"\n` +
    `3. Informe este mesmo e-mail e defina a sua senha\n\n` +
    `A senha é só sua — não precisa compartilhar com ninguém, nem com a academia.`
  );
}

/**
 * Mensagem genérica de pendência de mensalidade — usada pelo botão de
 * WhatsApp da central de notificações (Fase 9). Deliberadamente sem valor
 * nem data: a notificação não carrega esses dados (evita duplicar dado
 * financeiro que pode ficar desatualizado); quem quiser o valor exato abre a
 * ficha do aluno pelo link da própria notificação.
 */
export function mensagemPendenciaMensalidade(nome: string): string {
  const primeiroNome = nome.split(" ")[0];
  return `Olá, ${primeiroNome}. Identificamos uma pendência na sua mensalidade. Entre em contato com a academia para regularizar.`;
}

/** Mensagem de aniversário — botão de WhatsApp do alerta "aniversariante do dia". */
export function mensagemAniversario(nome: string, academia: string): string {
  const primeiroNome = nome.split(" ")[0];
  return (
    `Parabéns, ${primeiroNome}! 🎉\n\n` +
    `A equipe da ${academia} deseja um ótimo dia. Contamos com você no treino!`
  );
}

/**
 * Mensagem de retenção — botão de WhatsApp do alerta "aluno sem acesso" e da
 * reativação de alunos sumidos no Dashboard.
 *
 * `dias` aceita null porque o aluno pode estar sumido sem NUNCA ter acessado
 * (classificarRetencao devolve diasSemAcesso = null nesse caso). Escrever
 * "há null dias" seria pior do que omitir o número.
 */
export function mensagemAusencia(
  nome: string,
  academia: string,
  dias: number | null
): string {
  const primeiroNome = nome.split(" ")[0];
  const tempo = dias && dias > 0 ? `há ${dias} dias` : "faz um tempo";
  return (
    `Olá, ${primeiroNome}! 👋\n\n` +
    `Notamos que você não aparece na ${academia} ${tempo}. Sentimos sua falta — ` +
    `precisa de ajuda com algo?`
  );
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
