import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Logo from "@/components/Logo";
import { anoSaoPaulo } from "@/lib/utils";

export const metadata = {
  title: "Termos de Uso — GestAcad",
};

export default function TermosDeUsoPage() {
  const ano = anoSaoPaulo();

  return (
    <main className="min-h-dvh bg-ink-950 bg-grid-fade">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" /> Início
          </Link>
        </div>

        <div className="surface flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
          <p>
            Versão preliminar — sujeita à validação jurídica antes do uso
            comercial definitivo. Este texto não é um parecer jurídico.
          </p>
        </div>

        <h1 className="mt-8 text-2xl font-bold text-white">Termos de Uso</h1>
        <p className="mt-1 text-xs text-slate-500">Atualizados em {ano}</p>

        <div className="prose-gestacad mt-6 space-y-6 text-sm leading-relaxed text-slate-300">
          <Secao titulo="Finalidade do sistema">
            <p>
              O GestAcad é um sistema de gestão para academias: organiza
              cadastro de alunos, mensalidades, controle de acesso e fichas
              de treino, e disponibiliza uma área pessoal para o aluno
              consultar sua situação.
            </p>
          </Secao>

          <Secao titulo="Responsabilidades da academia">
            <p>
              A academia é responsável por manter corretos os dados que
              cadastra (alunos, planos, cobranças, política de acesso) e por
              atender pedidos do aluno relacionados aos seus próprios dados.
            </p>
          </Secao>

          <Secao titulo="Responsabilidades do usuário">
            <p>
              O link/token pessoal de acesso à área do aluno é de{" "}
              <strong>uso individual</strong> — a mesma pessoa a quem ele foi
              atribuído. Compartilhar essa credencial com terceiros não é
              permitido, pois qualquer pessoa que a tenha em mãos consegue
              abrir a área do aluno correspondente.
            </p>
          </Secao>

          <Secao titulo="Informações financeiras">
            <p>
              Os valores, vencimentos e status de mensalidades exibidos na
              área do aluno vêm diretamente do cadastro feito pela academia.{" "}
              <strong>
                Um pagamento só é considerado confirmado depois de validado
                pela própria academia
              </strong>{" "}
              — o aluno não confirma pagamentos por conta própria dentro do
              sistema.
            </p>
          </Secao>

          <Secao titulo="Limitações do piloto">
            <p>
              O GestAcad está em fase de piloto. Algumas funcionalidades
              descritas para o futuro (como login próprio do aluno, QR de
              acesso rotativo ou notificações automáticas) ainda não estão
              disponíveis nesta versão. Recursos podem ser ajustados conforme
              o piloto avança.
            </p>
          </Secao>

          <Secao titulo="Disponibilidade">
            <p>
              O sistema pode passar por manutenções ou apresentar
              indisponibilidade temporária, especialmente durante o período
              de piloto.
            </p>
          </Secao>

          <Secao titulo="Validação jurídica">
            <p>
              Este texto foi escrito em linguagem simples para o período de
              piloto e ainda depende de revisão jurídica antes de ser
              utilizado como termo definitivo em uso comercial.
            </p>
          </Secao>
        </div>

        <div className="mt-10 border-t border-ink-700 pt-6 text-center text-xs text-slate-500">
          <Link href="/privacidade" className="underline-offset-2 hover:text-slate-300 hover:underline">
            Ver Política de Privacidade
          </Link>
        </div>
      </div>
    </main>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-white">{titulo}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
