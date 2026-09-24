import type { Metadata } from "next";
import Link from "next/link";
import { Archivo } from "next/font/google";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  LogIn,
  Package,
  ShieldCheck,
  Smartphone,
  UsersRound,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteHeader from "@/components/site/SiteHeader";
import FaqLista from "@/components/site/FaqLista";
import LandingEfeitos from "@/components/landing/LandingEfeitos";
import CenaAbertura from "@/components/landing/CenaAbertura";
import CenaCaosOrdem from "@/components/landing/CenaCaosOrdem";
import CenaPainel from "@/components/landing/CenaPainel";
import CenaAppAluno from "@/components/landing/CenaAppAluno";
import CenaFechamento from "@/components/landing/CenaFechamento";
import { PRECO_MENSAL_LABEL, linkWhatsappComercial } from "@/lib/site-config";
import { anoSaoPaulo } from "@/lib/utils";
import "./landing.css";

// Fonte só da landing: Archivo, com o eixo de largura para os títulos
// expandidos. O app (painel e aluno) continua em Inter.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

const TITULO_SITE = "GestAcad | Sistema de gestão para academias";
const DESCRICAO_SITE =
  "Gerencie alunos, mensalidades, acessos, treinos, financeiro e resultados da sua academia em uma única plataforma.";

export const metadata: Metadata = {
  title: TITULO_SITE,
  description: DESCRICAO_SITE,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITULO_SITE,
    description: DESCRICAO_SITE,
    url: "/",
    siteName: "GestAcad",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_SITE,
    description: DESCRICAO_SITE,
  },
};

// Todo CTA comercial aponta para a seção de contato; quando existe WhatsApp
// configurado, vai direto para a conversa. Nunca leva ao login (que é a ação
// de quem JÁ é cliente).
const HREF_DEMO = linkWhatsappComercial ?? "#contato";

// Só o destino externo (wa.me) abre em nova aba. Como âncora interna
// (#contato), abrir em aba nova seria errado. Por isso os atributos são
// condicionais, e nunca um `target="_blank"` fixo.
const PROPS_DEMO = linkWhatsappComercial
  ? { target: "_blank" as const, rel: "noopener noreferrer" }
  : {};

const MAIS_MODULOS = [
  {
    icon: Package,
    titulo: "Produtos e estoque",
    desc: "Controle de produtos, vendas e alerta quando o estoque fica baixo.",
  },
  {
    icon: Bell,
    titulo: "Central de notificações",
    desc: "Avisos de vencimento, atraso, aniversário e estoque dentro do painel.",
  },
  {
    icon: UsersRound,
    titulo: "Equipe e permissões",
    desc: "Proprietário, gerente, recepção e instrutor. Cada perfil vê só o que precisa.",
  },
  {
    icon: Smartphone,
    titulo: "Aplicativo do aluno",
    desc: "Treinos, mensalidades, frequência e QR Code de acesso no celular do aluno.",
  },
];

const IMPLANTACAO = [
  {
    titulo: "Conhecemos sua academia",
    desc: "Entendemos a operação, a quantidade de alunos e o que é prioridade para você.",
  },
  {
    titulo: "Configuramos o GestAcad",
    desc: "Ajustamos planos, usuários, permissões e as informações iniciais.",
  },
  {
    titulo: "Validamos juntos",
    desc: "Testamos os fluxos principais com a sua equipe antes da migração definitiva.",
  },
];

const SEGURANCA = [
  "Cada pessoa da equipe acessa com seu próprio usuário",
  "Permissões diferentes por perfil, com o financeiro restrito ao proprietário",
  "Dados separados por academia, sem cruzamento entre clientes",
  "Áreas internas protegidas por autenticação",
  "Histórico das ações críticas realizadas no painel",
  "Conexão segura entre o navegador e o sistema",
];

const INCLUSO_NO_PLANO = [
  "Gestão completa de alunos, planos e mensalidades",
  "Recepção com QR Code e histórico de acessos",
  "Treinos digitais e aplicativo do aluno",
  "Financeiro, retenção e relatórios",
  "Produtos, estoque e central de notificações",
  "Equipe com permissões por perfil",
  "Implantação acompanhada e suporte direto",
];

export default function Home() {
  const ano = anoSaoPaulo();

  return (
    <div className={`lp ${archivo.variable}`}>
      {/* Marca "com JS" antes da primeira pintura: sem isso, o CSS mostra as
          cenas no estado final (sem pin), que é o que vê quem não tem JS. */}
      <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('lp-js')" }} />
      <LandingEfeitos />
      <SiteHeader hrefDemo={HREF_DEMO} demoExterno={Boolean(linkWhatsappComercial)} />

      <main>
        <CenaAbertura hrefDemo={HREF_DEMO} propsDemo={PROPS_DEMO} />

        <CenaCaosOrdem />

        {/* ================= E TAMBÉM ================= */}
        <section className="lp-flow lp-mais" aria-labelledby="mais-titulo">
          <div className="lp-wrap lp-mais__grid">
            <h2 id="mais-titulo" className="lp-display lp-h3" data-reveal>
              E o resto da rotina também está lá.
            </h2>
            <ul className="lp-mais__lista">
              {MAIS_MODULOS.map(({ icon: Icon, titulo, desc }, i) => (
                <li key={titulo} data-reveal style={{ "--i": i } as React.CSSProperties}>
                  <Icon className="h-5 w-5 text-volt-300" aria-hidden="true" />
                  <h3>{titulo}</h3>
                  <p>{desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <CenaPainel />

        <CenaAppAluno />

        {/* ================= CONFIANÇA ================= */}
        <section id="como-funciona" className="lp-flow lp-confianca">
          <div className="lp-wrap lp-confianca__grid">
            <div>
              <h2 className="lp-display lp-h2" data-reveal>
                Implantação acompanhada de perto.
              </h2>
              <p className="lp-lede" data-reveal>
                O GestAcad está sendo desenvolvido e validado junto à rotina
                real de academias, priorizando simplicidade, suporte e melhoria
                contínua. Preferimos mostrar o sistema funcionando a exibir
                números que ainda não temos.
              </p>
              <ol className="lp-passos">
                {IMPLANTACAO.map(({ titulo, desc }, i) => (
                  <li key={titulo} data-reveal style={{ "--i": i } as React.CSSProperties}>
                    <span className="lp-passos__n">{i + 1}</span>
                    <div>
                      <h3>{titulo}</h3>
                      <p>{desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div id="seguranca" className="lp-seguranca">
              <ShieldCheck className="h-6 w-6 text-volt-300" aria-hidden="true" />
              <h2 className="lp-display lp-h3 mt-4" data-reveal>
                Os dados da sua academia ficam protegidos.
              </h2>
              <p className="mt-3 text-slate-400" data-reveal>
                Cada academia possui seu próprio ambiente, com usuários,
                permissões e dados separados.
              </p>
              <ul className="lp-checks">
                {SEGURANCA.map((item, i) => (
                  <li key={item} data-reveal style={{ "--i": i } as React.CSSProperties}>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-volt-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-slate-400">
                Conheça a{" "}
                <Link href="/privacidade" className="lp-link">
                  Política de Privacidade
                </Link>{" "}
                e os{" "}
                <Link href="/termos" className="lp-link">
                  Termos de Uso
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* ================= PLANO ================= */}
        <section id="planos" className="lp-flow lp-plano">
          <div className="lp-wrap lp-plano__grid">
            <div data-reveal>
              <h2 className="lp-display lp-h2">
                Um plano que acompanha o crescimento da sua academia.
              </h2>
              <p className="mt-8 text-sm text-slate-400">Planos a partir de</p>
              <p className="lp-plano__preco">
                <span className="lp-display">{PRECO_MENSAL_LABEL}</span>
                <small>/mês</small>
              </p>
              <p className="lp-lede">
                O valor é definido pela quantidade de alunos ativos e pelas
                necessidades da operação. Agende uma demonstração e conheça a
                melhor configuração para a sua academia.
              </p>
              <a href={HREF_DEMO} {...PROPS_DEMO} className="lp-btn lp-btn--volt mt-8">
                Quero conhecer o GestAcad
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <div className="lp-plano__incluso" data-reveal>
              <p className="lp-plano__rotulo">Incluso no plano</p>
              <ul className="lp-checks">
                {INCLUSO_NO_PLANO.map((item) => (
                  <li key={item}>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-volt-300" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-xs leading-relaxed text-slate-500">
                O valor pode variar de acordo com a quantidade de alunos ativos,
                integrações e serviços contratados. Integrações específicas,
                equipamentos de acesso, mensagens automatizadas e serviços
                personalizados podem ter condições adicionais.
              </p>
            </div>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section id="duvidas" className="lp-flow lp-faq">
          <div className="lp-wrap lp-faq__grid">
            <div className="lp-faq__lado">
              <h2 className="lp-display lp-h2" data-reveal>
                Perguntas frequentes.
              </h2>
              <p className="mt-4 text-slate-400" data-reveal>
                O que as academias mais perguntam antes de trocar de sistema.
              </p>
            </div>
            <FaqLista />
          </div>
        </section>

        <CenaFechamento hrefWhatsapp={linkWhatsappComercial} />
      </main>

      {/* ================= RODAPÉ ================= */}
      <footer className="lp-rodape">
        <div className="lp-wrap">
          <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Gestão completa para academias: alunos, mensalidades, acessos,
                treinos e financeiro em um só lugar.
              </p>
            </div>

            <nav aria-label="Rodapé" className="flex gap-12">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Produto
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li>
                    <a href="#funcionalidades" className="hover:text-slate-200">
                      Funcionalidades
                    </a>
                  </li>
                  <li>
                    <a href="#aplicativo" className="hover:text-slate-200">
                      Aplicativo do aluno
                    </a>
                  </li>
                  <li>
                    <a href="#planos" className="hover:text-slate-200">
                      Planos
                    </a>
                  </li>
                  <li>
                    <a href="#duvidas" className="hover:text-slate-200">
                      Dúvidas
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Acesso
                </h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li>
                    <Link href="/login" className="inline-flex items-center gap-1.5 hover:text-slate-200">
                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> Entrar
                    </Link>
                  </li>
                  <li>
                    <a href="#contato" className="hover:text-slate-200">
                      Contato
                    </a>
                  </li>
                  <li>
                    <Link href="/termos" className="hover:text-slate-200">
                      Termos de Uso
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacidade" className="hover:text-slate-200">
                      Política de Privacidade
                    </Link>
                  </li>
                </ul>
              </div>
            </nav>
          </div>

          <p className="mt-10 border-t border-ink-700/60 pt-6 text-xs text-slate-500">
            © {ano} GestAcad. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
