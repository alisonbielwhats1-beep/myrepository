import { MessageCircle } from "lucide-react";
import { linkWhats, mensagemCobranca } from "@/lib/whats";

/**
 * Botão "Cobrar no WhatsApp": abre o WhatsApp com a mensagem de cobrança já
 * pronta para o telefone do aluno. Grátis, sem API — é só apertar enviar.
 * Se o aluno não tiver telefone válido, não renderiza nada.
 */
export default function BotaoCobrancaWhats({
  nome,
  telefone,
  academia,
  valor,
  data,
  vencida,
  compacto = false,
}: {
  nome: string;
  telefone: string | null | undefined;
  academia: string;
  valor: string;
  data: string;
  vencida: boolean;
  compacto?: boolean;
}) {
  const texto = mensagemCobranca({ nome, academia, valor, data, vencida });
  const href = linkWhats(telefone, texto);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      title="Cobrar no WhatsApp"
      className={
        compacto
          ? "inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          : "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/20"
      }
    >
      <MessageCircle className={compacto ? "h-3.5 w-3.5" : "h-4 w-4"} />
      Cobrar
    </a>
  );
}
