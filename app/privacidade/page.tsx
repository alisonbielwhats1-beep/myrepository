import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import Logo from "@/components/Logo";

export const metadata = {
  title: "Política de Privacidade — GestAcad",
};

export default function PoliticaPrivacidadePage() {
  const ano = new Date().getFullYear();

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
            comercial definitivo. Este texto explica, em linguagem simples,
            como o GestAcad trata dados durante o piloto; não é um parecer
            jurídico.
          </p>
        </div>

        <h1 className="mt-8 text-2xl font-bold text-white">
          Política de Privacidade
        </h1>
        <p className="mt-1 text-xs text-slate-500">Atualizada em {ano}</p>

        <div className="prose-gestacad mt-6 space-y-6 text-sm leading-relaxed text-slate-300">
          <Secao titulo="Quem processa os dados">
            <p>
              O GestAcad é o sistema utilizado pela academia para gerenciar
              sua operação. A <strong>academia é responsável pelos dados
              cadastrados</strong> de seus próprios alunos, equipe e
              financeiro — o GestAcad processa esses dados a pedido da
              academia, dentro do ambiente exclusivo dela.
            </p>
          </Secao>

          <Secao titulo="Quais dados são processados">
            <p>
              Para operar a gestão de alunos, mensalidades, acessos e
              treinos, o sistema trata dados como nome, contato, matrícula,
              plano contratado, histórico financeiro, registros de entrada na
              academia e fichas de treino. Fotos de perfil podem ser
              armazenadas quando o aluno ou a academia optam por enviá-las.
            </p>
          </Secao>

          <Secao titulo="Acesso do aluno por link pessoal">
            <p>
              Durante o piloto, o aluno acessa sua área pessoal por um link
              individual (token), sem necessidade de login com senha. Essa é
              uma solução <strong>temporária</strong>, pensada para os
              primeiros clientes — substituí-la por uma conta com login
              próprio é uma melhoria já prevista para depois do piloto.
            </p>
          </Secao>

          <Secao titulo="Registros técnicos e auditoria">
            <p>
              O sistema mantém registros técnicos de determinadas ações (por
              exemplo, alterações de cadastro, pagamentos e acessos) para
              fins de segurança, suporte e auditoria interna da academia.
            </p>
          </Secao>

          <Secao titulo="Separação entre academias">
            <p>
              Os dados de cada academia ficam separados dos dados de outras
              academias que utilizam o GestAcad — uma academia não visualiza
              informações de alunos de outra.
            </p>
          </Secao>

          <Secao titulo="Correção ou exclusão de dados">
            <p>
              Como a academia é a responsável pelos dados dos seus alunos,
              pedidos de correção ou exclusão devem ser feitos diretamente à
              própria academia, que é quem administra o cadastro.
            </p>
          </Secao>

          <Secao titulo="Validação jurídica">
            <p>
              Este texto foi escrito em linguagem simples para o período de
              piloto e ainda depende de revisão jurídica antes de ser
              utilizado como política definitiva em uso comercial.
            </p>
          </Secao>
        </div>

        <div className="mt-10 border-t border-ink-700 pt-6 text-center text-xs text-slate-500">
          <Link href="/termos" className="underline-offset-2 hover:text-slate-300 hover:underline">
            Ver Termos de Uso
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
