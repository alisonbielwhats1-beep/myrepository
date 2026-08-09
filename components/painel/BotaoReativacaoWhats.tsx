import { MessageCircle } from "lucide-react";
import { linkWhats, mensagemAusencia } from "@/lib/whats";

/**
 * Botão "Reativar no WhatsApp": abre o WhatsApp com uma mensagem de RETENÇÃO
 * (não de cobrança) para um aluno sumido. Mesmo padrão visual e mesmos helpers
 * de BotaoCobrancaWhats — muda só o tom da mensagem e a cor, já que a
 * finalidade aqui é trazer o aluno de volta, não pedir dinheiro.
 *
 * Sem telefone cadastrado não vira erro nem some silenciosamente: mostra
 * "Sem WhatsApp", para quem olha o Dashboard entender que falta o cadastro.
 */
export default function BotaoReativacaoWhats({
  nome,
  telefone,
  academia,
  diasSemAcesso,
  compacto = false,
  isDemo = false,
}: {
  nome: string;
  telefone: string | null | undefined;
  academia: string;
  diasSemAcesso: number | null;
  compacto?: boolean;
  isDemo?: boolean;
}) {
  const classeBase = compacto
    ? "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition"
    : "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition";
  const tamanhoIcone = compacto ? "h-3.5 w-3.5" : "h-4 w-4";

  if (isDemo) {
    return (
      <span
        title="Ação indisponível no ambiente de demonstração"
        aria-disabled="true"
        className={`${classeBase} cursor-not-allowed select-none border-slate-700 text-slate-600`}
      >
        <MessageCircle className={tamanhoIcone} />
        Reativar
      </span>
    );
  }

  const href = linkWhats(telefone, mensagemAusencia(nome, academia, diasSemAcesso), {
    isDemo,
  });

  if (!href) {
    return (
      <span
        title="Aluno sem WhatsApp cadastrado"
        aria-disabled="true"
        className={`${classeBase} cursor-not-allowed select-none border-slate-700 text-slate-600`}
      >
        <MessageCircle className={tamanhoIcone} />
        Sem WhatsApp
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Reativar pelo WhatsApp"
      className={`${classeBase} border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20`}
    >
      <MessageCircle className={tamanhoIcone} />
      Reativar
    </a>
  );
}
