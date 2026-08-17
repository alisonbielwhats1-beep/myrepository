import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Dumbbell,
  FileSpreadsheet,
  Heart,
  LogIn,
  Package,
  QrCode,
  ShieldCheck,
  Smartphone,
  Users,
  UsersRound,
} from "lucide-react";
import Logo from "@/components/Logo";
import SiteHeader from "@/components/site/SiteHeader";
import HeroProduto from "@/components/site/HeroProduto";
import FaqLista from "@/components/site/FaqLista";
import { PRECO_MENSAL_LABEL, linkWhatsappComercial } from "@/lib/site-config";
import { anoSaoPaulo } from "@/lib/utils";

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
// (#contato), abrir em aba nova seria errado — por isso os atributos são
// condicionais, e nunca um `target="_blank"` fixo.
const PROPS_DEMO = linkWhatsappComercial
  ? { target: "_blank" as const, rel: "noopener noreferrer" }
  : {};

const PROBLEMAS = [
  {
    icon: DollarSign,
    problema: "Mensalidade atrasada que ninguém percebe",
    solucao:
      "O sistema acompanha os vencimentos e destaca quem está em atraso, sem depender de conferência manual.",
  },
  {
    icon: FileSpreadsheet,
    problema: "Cadastro espalhado em caderno e planilha",
    solucao:
      "Ficha, plano, contato, histórico financeiro e treinos do aluno reunidos em um só lugar.",
  },
  {
    icon: ClipboardList,
    problema: "Controle de entrada feito no papel",
    solucao:
      "A recepção registra o acesso pelo painel ou validando o QR Code do aluno, com histórico de quem entrou.",
  },
  {
    icon: Dumbbell,
    problema: "Ficha de treino perdida ou desatualizada",
    solucao:
      "O professor monta a ficha no painel e ela aparece no celular do aluno, sempre na versão atual.",
  },
  {
    icon: BarChart3,
    problema: "Falta de visão do resultado do mês",
    solucao:
      "Receitas, despesas, lucro e evolução financeira calculados a partir do que já foi registrado.",
  },
  {
    icon: CalendarX2,
    problema: "Aluno que some sem ninguém notar",
    solucao:
      "A tela de retenção mostra quem está deixando de frequentar, com base nos acessos reais.",
  },
];

const FUNCIONALIDADES = [
  {
    icon: Users,
    titulo: "Gestão de alunos",
    desc: "Cadastro, plano, situação financeira, histórico e ficha completa em um único lugar.",
  },
  {
    icon: DollarSign,
    titulo: "Mensalidades e pagamentos",
    desc: "Cobranças, vencimentos, baixas e acompanhamento da inadimplência com clareza.",
  },
  {
    icon: QrCode,
    titulo: "Recepção e QR Code",
    desc: "O aluno apresenta seu QR Code e a recepção valida o acesso com segurança.",
  },
  {
    icon: Dumbbell,
    titulo: "Treinos digitais",
    desc: "Professores montam as fichas e o aluno acompanha, executa e retoma o treino pelo celular.",
  },
  {
    icon: BarChart3,
    titulo: "Financeiro",
    desc: "Receitas, despesas por categoria, resultado do período e evolução do caixa.",
  },
  {
    icon: Heart,
    titulo: "Retenção",
    desc: "Identifique quem está se afastando antes que o aluno abandone a academia.",
  },
  {
    icon: Package,
    titulo: "Produtos e estoque",
    desc: "Controle de produtos, vendas e alertas quando o estoque fica baixo.",
  },
  {
    icon: Bell,
    titulo: "Central de notificações",
    desc: "Alertas operacionais de vencimento, atraso, aniversário e estoque dentro do painel.",
  },
  {
    icon: Smartphone,
    titulo: "Aplicativo do aluno",
    desc: "Treinos, mensalidades, frequência e QR Code de acesso na palma da mão do aluno.",
  },
  {
    icon: UsersRound,
    titulo: "Equipe e permissões",
    desc: "Cada perfil enxerga apenas o que precisa: proprietário, gerente, recepção ou instrutor.",
  },
];

const IMPLANTACAO = [
  {
    n: "1",
    titulo: "Conhecemos sua academia",
    desc: "Entendemos sua operação, a quantidade de alunos e as necessidades principais.",
  },
  {
    n: "2",
    titulo: "Configuramos o GestAcad",
    desc: "Ajustamos planos, usuários, permissões e as informações iniciais.",
  },
  {
    n: "3",
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
    <>
      <SiteHeader hrefDemo={HREF_DEMO} demoExterno={Boolean(linkWhatsappComercial)} />

      <main id="topo" className="bg-ink-950 pt-16">
        {/* ================= HERO ================= */}
        <section className="relative overflow-hidden bg-grid-fade">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-volt-500/10 blur-[120px]"
          />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
            <div className="animate-fade-up motion-reduce:animate-none">
              <span className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.18em] text-volt-300">
                <span className="h-px w-7 bg-volt-400" aria-hidden="true" />
                Gestão completa para academias
              </span>
              <h1 className="mt-5 text-[2.1rem] font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[3.4rem]">
                Sua academia organizada.{" "}
                <span className="text-volt-300">
                  Seus alunos mais conectados.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
                Gerencie alunos, mensalidades, acessos, treinos e sua operação em
                um só lugar.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={HREF_DEMO} {...PROPS_DEMO} className="btn-volt !py-3 text-base">
                  Quero conhecer o GestAcad
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a href="#o-produto" className="btn-ghost !py-3 text-base">
                  Ver o sistema
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
                {[
                  "Dados separados por academia",
                  "Equipe com permissões",
                  "Experiência para o aluno",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-1.5 text-sm text-slate-400"
                  >
                    <CheckCircle2
                      className="h-4 w-4 text-volt-300"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="animate-fade-up motion-reduce:animate-none lg:pb-20">
              <HeroProduto />
            </div>
          </div>
        </section>

        {/* ================= PROBLEMAS ================= */}
        <section
          id="problemas"
          className="scroll-mt-20 border-t border-ink-700/60 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Menos planilhas, atrasos e tarefas manuais
              </h2>
              <p className="mt-3 text-slate-400">
                Os problemas que mais aparecem no dia a dia de uma academia — e
                como o GestAcad resolve cada um deles.
              </p>
            </div>

            <ul className="mt-10 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {PROBLEMAS.map(({ icon: Icon, problema, solucao }) => (
                <li key={problema}>
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-800 text-volt-300 ring-1 ring-ink-600/60">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{problema}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {solucao}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= FUNCIONALIDADES ================= */}
        <section
          id="funcionalidades"
          className="scroll-mt-20 border-t border-ink-700/60 bg-ink-900/30 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Tudo o que a sua academia precisa,{" "}
                <span className="text-volt-300">sem sistema paralelo</span>
              </h2>
              <p className="mt-3 text-slate-400">
                Recursos que já funcionam hoje — nada aqui está &ldquo;em
                breve&rdquo;.
              </p>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FUNCIONALIDADES.map(({ icon: Icon, titulo, desc }) => (
                <li
                  key={titulo}
                  className="surface rounded-2xl p-5 transition hover:border-ink-500 motion-reduce:transition-none"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700 text-volt-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {desc}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= PAINEL ================= */}
        <section
          id="painel"
          className="scroll-mt-20 border-t border-ink-700/60 py-16 sm:py-20"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Tudo o que acontece na academia, em uma única visão
              </h2>
              <p className="mt-3 text-slate-400">
                Acompanhe alunos, pagamentos, acessos, retenção e financeiro sem
                depender de várias planilhas ou sistemas separados.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  "Visão geral da operação do dia",
                  "Acompanhamento financeiro do período",
                  "Alertas de vencimento e inadimplência",
                  "Alunos que estão se afastando",
                  "Acessos recentes da recepção",
                  "Indicadores calculados sobre dados reais",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-volt-300"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface rounded-3xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Painel · visão do proprietário
                </span>
                <span className="chip border-ink-600 bg-ink-700/60 text-[10px] text-slate-300">
                  Demonstração
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                <LinhaPainel
                  icon={Users}
                  titulo="Alunos ativos"
                  valor="184"
                  detalhe="12 novos neste mês"
                />
                <LinhaPainel
                  icon={DollarSign}
                  titulo="Recebido no mês"
                  valor="R$ 21.480"
                  detalhe="R$ 3.120 em aberto"
                />
                <LinhaPainel
                  icon={QrCode}
                  titulo="Acessos hoje"
                  valor="63"
                  detalhe="pico às 19h"
                />
                <LinhaPainel
                  icon={AlertTriangle}
                  titulo="Precisam de atenção"
                  valor="7"
                  detalhe="sem frequentar há 15 dias"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ================= APLICATIVO DO ALUNO ================= */}
        <section
          id="aplicativo"
          className="scroll-mt-20 border-t border-ink-700/60 bg-ink-900/30 py-16 sm:py-20"
        >
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <div className="surface mx-auto max-w-xs rounded-3xl p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    Área do aluno
                  </span>
                  <span className="chip border-ink-600 bg-ink-700/60 text-[10px] text-slate-300">
                    Demonstração
                  </span>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {[
                    { icon: QrCode, t: "QR Code de acesso", d: "validado na recepção" },
                    { icon: Dumbbell, t: "Treino B — Costas", d: "6 exercícios · em andamento" },
                    { icon: DollarSign, t: "Mensalidade de julho", d: "paga em 05/07" },
                    { icon: BarChart3, t: "Frequência", d: "12 acessos no mês" },
                  ].map(({ icon: Icon, t, d }) => (
                    <li
                      key={t}
                      className="flex items-center gap-3 rounded-xl border border-ink-600/60 bg-ink-900/50 p-3"
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-700 text-volt-300">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-white">
                          {t}
                        </span>
                        <span className="block truncate text-[11px] text-slate-400">
                          {d}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Uma experiência moderna também para seus alunos
              </h2>
              <p className="mt-3 text-slate-400">
                Cada aluno recebe um link pessoal da academia e acessa tudo pelo
                celular, sem precisar instalar nada.
              </p>

              <ul className="mt-8 space-y-3">
                {[
                  "Consulta a ficha de treino publicada pelo professor",
                  "Inicia, retoma e finaliza o treino registrando carga e repetições",
                  "Acompanha mensalidades, vencimentos e pagamentos confirmados",
                  "Vê a própria frequência e o histórico de acessos",
                  "Apresenta o QR Code, que a recepção valida com segurança",
                  "Atualiza a foto de perfil e fala com a academia",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-volt-300"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ================= IMPLANTAÇÃO ================= */}
        <section
          id="como-funciona"
          className="scroll-mt-20 border-t border-ink-700/60 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Como funciona a implantação
              </h2>
            </div>

            <ol className="mt-10 grid gap-6 sm:grid-cols-3">
              {IMPLANTACAO.map(({ n, titulo, desc }) => (
                <li key={n} className="surface rounded-2xl p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-volt-300 text-sm font-bold text-ink-950">
                    {n}
                  </span>
                  <h3 className="mt-4 font-semibold text-white">{titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                    {desc}
                  </p>
                </li>
              ))}
            </ol>

            <p className="mt-6 text-sm text-slate-400">
              A implantação é acompanhada para que sua equipe comece a usar o
              sistema com segurança.
            </p>
          </div>
        </section>

        {/* ================= SEGURANÇA ================= */}
        <section
          id="seguranca"
          className="scroll-mt-20 border-t border-ink-700/60 bg-ink-900/30 py-16 sm:py-20"
        >
          <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 sm:px-6 lg:grid-cols-2">
            <div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink-800 text-volt-300 ring-1 ring-ink-600/60">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Os dados da sua academia ficam protegidos
              </h2>
              <p className="mt-3 text-slate-400">
                Cada academia possui seu próprio ambiente, com usuários,
                permissões e dados separados.
              </p>
              <p className="mt-4 text-sm text-slate-400">
                Conheça a{" "}
                <Link
                  href="/privacidade"
                  className="text-volt-300 underline-offset-2 hover:underline"
                >
                  Política de Privacidade
                </Link>{" "}
                e os{" "}
                <Link
                  href="/termos"
                  className="text-volt-300 underline-offset-2 hover:underline"
                >
                  Termos de Uso
                </Link>
                .
              </p>
            </div>

            <ul className="space-y-3">
              {SEGURANCA.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-xl border border-ink-600/60 bg-ink-900/40 p-4 text-sm text-slate-300"
                >
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-volt-300"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ================= PLANO ================= */}
        <section
          id="planos"
          className="scroll-mt-20 border-t border-ink-700/60 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Um plano que acompanha o crescimento da sua academia
              </h2>
              <p className="mt-3 text-slate-400">
                O valor é definido de acordo com a quantidade de alunos ativos e
                as necessidades da operação.
              </p>
            </div>

            <div className="mx-auto mt-10 max-w-lg">
              <div className="surface-strong rounded-3xl border-volt-500/30 p-8 shadow-card">
                <p className="text-sm text-slate-400">Planos a partir de</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold tracking-tight text-white">
                    {PRECO_MENSAL_LABEL}
                  </span>
                  <span className="text-sm text-slate-400">/mês</span>
                </p>
                <p className="mt-3 text-sm text-slate-400">
                  Agende uma demonstração e conheça a melhor configuração para
                  sua academia.
                </p>

                <ul className="mt-7 space-y-2.5">
                  {INCLUSO_NO_PLANO.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-volt-300"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>

                <a href={HREF_DEMO} {...PROPS_DEMO} className="btn-volt mt-8 w-full !py-3">
                  Agendar demonstração
                </a>

                <p className="mt-5 text-xs leading-relaxed text-slate-500">
                  O valor pode variar de acordo com a quantidade de alunos
                  ativos, integrações e serviços contratados.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Integrações específicas, equipamentos de acesso, mensagens
                  automatizadas e serviços personalizados podem possuir
                  condições adicionais.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= PROVA SOCIAL HONESTA ================= */}
        <section className="border-t border-ink-700/60 bg-ink-900/30 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Implantação acompanhada de perto
            </h2>
            <p className="mt-4 leading-relaxed text-slate-400">
              O GestAcad está sendo desenvolvido e validado junto à rotina real
              de academias, priorizando simplicidade, suporte e melhoria
              contínua. Preferimos mostrar o sistema funcionando a exibir
              números que ainda não temos.
            </p>
          </div>
        </section>

        {/* ================= FAQ ================= */}
        <section
          id="duvidas"
          className="scroll-mt-20 border-t border-ink-700/60 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Perguntas frequentes
              </h2>
            </div>
            <div className="mt-10">
              <FaqLista />
            </div>
          </div>
        </section>

        {/* ================= CTA FINAL ================= */}
        <section
          id="contato"
          className="scroll-mt-20 border-t border-ink-700/60 bg-grid-fade py-16 sm:py-20"
        >
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Pronto para organizar sua academia?
            </h2>
            <p className="mt-4 text-slate-400">
              Conheça o GestAcad e veja como simplificar sua gestão, acompanhar
              seus alunos e ter mais controle da operação.
            </p>

            {linkWhatsappComercial ? (
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <a
                  href={linkWhatsappComercial}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-volt !py-3 text-base"
                >
                  Agendar demonstração
                </a>
                <a href="#funcionalidades" className="btn-ghost !py-3 text-base">
                  Ver como funciona
                </a>
              </div>
            ) : (
              // Sem número comercial configurado, nenhum canal é inventado: a
              // página diz a verdade em vez de exibir um botão que não leva a
              // lugar nenhum. Basta definir NEXT_PUBLIC_WHATSAPP_COMERCIAL
              // para os botões acima aparecerem.
              <div className="surface mx-auto mt-8 max-w-md rounded-2xl p-6 text-sm text-slate-300">
                <p className="font-medium text-white">
                  Canal de contato em configuração
                </p>
                <p className="mt-2 leading-relaxed text-slate-400">
                  O WhatsApp comercial ainda não foi configurado nesta
                  instalação. Assim que o número for definido, o botão de
                  contato aparece aqui automaticamente.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ================= RODAPÉ ================= */}
        <footer className="border-t border-ink-700 py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
              <div className="max-w-xs">
                <Logo />
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  Gestão completa para academias: alunos, mensalidades,
                  acessos, treinos e financeiro em um só lugar.
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
      </main>
    </>
  );
}

function LinhaPainel({
  icon: Icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: typeof Users;
  titulo: string;
  valor: string;
  detalhe: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-ink-600/60 bg-ink-900/50 p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink-700 text-volt-300">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{titulo}</p>
        <p className="truncate text-xs text-slate-400">{detalhe}</p>
      </div>
      <p className="shrink-0 text-lg font-bold tabular-nums text-white">{valor}</p>
    </div>
  );
}
