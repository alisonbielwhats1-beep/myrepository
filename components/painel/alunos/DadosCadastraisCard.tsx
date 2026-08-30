import {
  Cake,
  CreditCard,
  HeartPulse,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Target,
  UserRound,
} from "lucide-react";
import { Aluno } from "@/lib/types";
import { calcularIdade, cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Cartão "Dados do aluno" — resumo cadastral só-leitura da ficha
// ---------------------------------------------------------------------------

/** Formata 11 dígitos como 000.000.000-00; devolve como está se não tiver 11. */
function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Resumo só-leitura dos dados cadastrais do aluno selecionado (telefone,
 * e-mail, CPF, nascimento/idade, objetivo, contato de emergência). Antes esses
 * campos só apareciam abrindo "Editar" — o dono precisava entrar na edição só
 * para ver um telefone. O objetivo continua restrito à equipe (não é exposto no
 * app do aluno). Enquanto os dados carregam (busca sob demanda), mostra um
 * esqueleto discreto; `detalhe` só é usado quando o id bate com o selecionado,
 * para nunca exibir dados de um aluno anterior.
 */
export default function DadosCadastraisCard({
  alunoId,
  detalhe,
  onEditar,
}: {
  alunoId: string;
  detalhe: Aluno | null;
  onEditar: () => void;
}) {
  const pronto = detalhe?.id === alunoId;
  const idade = pronto ? calcularIdade(detalhe!.data_nascimento) : null;
  const nascimento = pronto && detalhe!.data_nascimento
    ? new Date(detalhe!.data_nascimento.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR")
    : null;

  return (
    <div className="surface rounded-2xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <UserRound className="h-4 w-4 text-volt-300" /> Dados do aluno
        </h3>
        <button
          type="button"
          onClick={onEditar}
          className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-white"
        >
          <Pencil className="h-3.5 w-3.5" /> Editar
        </button>
      </div>

      {!pronto ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados…
        </div>
      ) : (
        <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <LinhaDado icon={Phone} rotulo="Telefone" valor={detalhe!.telefone} />
          <LinhaDado icon={Mail} rotulo="E-mail" valor={detalhe!.email} />
          <LinhaDado
            icon={CreditCard}
            rotulo="CPF"
            valor={detalhe!.cpf ? formatarCpf(detalhe!.cpf) : null}
          />
          <LinhaDado
            icon={Cake}
            rotulo="Nascimento"
            valor={
              nascimento
                ? idade != null
                  ? `${nascimento} · ${idade} anos`
                  : nascimento
                : null
            }
          />
          <LinhaDado icon={Target} rotulo="Objetivo" valor={detalhe!.objetivo} />
          <LinhaDado
            icon={HeartPulse}
            rotulo="Emergência"
            valor={
              detalhe!.contato_emergencia_nome || detalhe!.contato_emergencia_telefone
                ? [detalhe!.contato_emergencia_nome, detalhe!.contato_emergencia_telefone]
                    .filter(Boolean)
                    .join(" · ")
                : null
            }
          />
        </dl>
      )}
    </div>
  );
}

function LinhaDado({
  icon: Icon,
  rotulo,
  valor,
}: {
  icon: typeof UserRound;
  rotulo: string;
  valor: string | null;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 flex-none text-slate-500" />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {rotulo}
        </dt>
        <dd className={cn("text-sm", valor ? "text-slate-200" : "text-slate-600")}>
          {valor ?? "—"}
        </dd>
      </div>
    </div>
  );
}
