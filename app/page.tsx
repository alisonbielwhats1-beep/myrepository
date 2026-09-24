import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import {
  ArrowRight,
  Barbell,
  Bell,
  CalendarCheck,
  ChartBar,
  CheckCircle,
  CurrencyCircleDollar,
  DeviceMobile,
  HeartStraight,
  Package,
  Plus,
  QrCode,
  ShieldCheck,
  Users,
  UsersThree,
  Wallet,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import Marca from "@/components/site/split/Marca";
import Espinha from "@/components/site/split/Espinha";
import Motor from "@/components/site/split/Motor";
import {
  CelularFechamento,
  HeroCelular,
  HeroRecepcao,
} from "@/components/site/split/Superficies";
import { EVENTOS, LEGENDAS } from "@/components/site/split/demo";
import { CartoesAcademia, CartoesAluno } from "@/components/site/split/Cartoes";
import { PRECO_MENSAL_LABEL, linkWhatsappComercial } from "@/lib/site-config";
import { anoSaoPaulo } from "@/lib/utils";
// Ordem importa: o engine primeiro, os estilos da landing por cima.
import "@/components/site/split/scrollcraft.css";
import "@/components/site/split/split.css";

// Tipografia só da landing: Archivo condensada nos títulos (com eixo de
// largura), Geist no texto e Geist Mono em horários e rótulos de dados.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });

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

// Todo CTA comercial aponta para o contato; quando existe WhatsApp
// configurado, vai direto para a conversa. Nunca leva ao login (que é a ação
// de quem JÁ é cliente). Um rótulo só para essa intenção na página inteira.
const HREF_DEMO = linkWhatsappComercial ?? "#contato";
const PROPS_DEMO = linkWhatsappComercial
  ? { target: "_blank" as const, rel: "noopener noreferrer" }
  : {};
const ROTULO_CTA = "Quero conhecer o GestAcad";

// Mídia gerada para a landing (Higgsfield). Nome novo a cada troca de arte,
// para celular com cache antigo não ficar com a versão anterior.
const M = {
  // Topo: um still do Soul 2 por lado (dia na recepção, noite no treino).
  heroAFundo: "/landing/hero-academia-v2.webp",
  heroBFundo: "/landing/hero-aluno-v2.webp",
  // Os dois lados da cena principal, gerados no Higgsfield: stills no Soul 2
  // e clipes de 5 s no Kling 3.0 (aluna: Standard; dono: Turbo). Tocam em
  // loop ida e volta (10 s), sem app dentro das telas.
  aluna: "/landing/conexao-aluna-v1.mp4",
  alunaMovel: "/landing/conexao-aluna-m-v1.mp4",
  alunaPoster: "/landing/conexao-aluna-poster-v1.webp",
  dono: "/landing/conexao-dono-v1.mp4",
  donoMovel: "/landing/conexao-dono-m-v1.mp4",
  donoPoster: "/landing/conexao-dono-poster-v1.webp",
  // Teste com teto de US$ 1,50: só o pico tem vídeo; as cenas de recursos
  // são fotos com movimento lento em CSS.
  recAPoster: "/landing/recursos-academia-v2.webp",
  recBPoster: "/landing/recursos-aluno-v2.webp",
};


const DORES_ACADEMIA = [
  { dor: "Mensalidade atrasada que ninguém percebe.", detalhe: "Só aparece quando alguém confere o caderno." },
  { dor: "Entrada anotada no papel.", detalhe: "Sem histórico de quem entrou nem de quando." },
  { dor: "O resultado do mês só no fim do mês.", detalhe: "Depois que alguém soma a planilha." },
];
const DORES_ALUNO = [
  { dor: "A ficha de treino some ou fica velha.", detalhe: "Papel na prancheta, foto no celular, versão de meses atrás." },
  { dor: "Quem para de vir não é notado.", detalhe: "Ninguém vê a frequência caindo até o aluno cancelar." },
  { dor: "Mensalidade paga? Só perguntando.", detalhe: "Toda dúvida vira mensagem para a recepção responder." },
];

const RECURSOS_ACADEMIA = [
  { icon: Users, titulo: "Gestão de alunos", desc: "Cadastro, plano, situação financeira, histórico e ficha em um lugar." },
  { icon: CurrencyCircleDollar, titulo: "Mensalidades", desc: "Cobranças, vencimentos, baixas e inadimplência com clareza." },
  { icon: QrCode, titulo: "Recepção e QR Code", desc: "A recepção valida o QR do aluno e o acesso entra no histórico." },
  { icon: ChartBar, titulo: "Financeiro", desc: "Receitas, despesas por categoria e o resultado do período." },
  { icon: HeartStraight, titulo: "Retenção", desc: "Quem está se afastando, com base nos acessos reais." },
  { icon: Package, titulo: "Produtos e estoque", desc: "Vendas e alerta quando o estoque fica baixo." },
  { icon: Bell, titulo: "Notificações", desc: "Vencimento, atraso, aniversário e estoque dentro do painel." },
  { icon: UsersThree, titulo: "Equipe e permissões", desc: "Proprietário, gerente, recepção ou instrutor: cada um vê o que precisa." },
];
const RECURSOS_ALUNO = [
  { icon: Barbell, titulo: "Treinos no celular", desc: "A ficha publicada pelo professor, para iniciar, retomar e finalizar." },
  { icon: CalendarCheck, titulo: "Carga e repetições", desc: "O aluno registra o que fez em cada série." },
  { icon: Wallet, titulo: "Mensalidades", desc: "Vencimentos e pagamentos confirmados, sem perguntar na recepção." },
  { icon: QrCode, titulo: "QR de acesso", desc: "Apresenta na recepção, que valida com segurança." },
  { icon: DeviceMobile, titulo: "Frequência e perfil", desc: "O próprio histórico de acessos, a foto e o contato com a academia." },
];

const IMPLANTACAO = [
  { titulo: "Conhecemos sua academia", desc: "A operação, a quantidade de alunos e o que é prioridade." },
  { titulo: "Configuramos o GestAcad", desc: "Planos, usuários, permissões e as informações iniciais." },
  { titulo: "Validamos juntos", desc: "Os fluxos principais com a sua equipe, antes da migração definitiva." },
];
const ACESSO_ALUNO = [
  { titulo: "Recebe o link da academia", desc: "Um link pessoal, que abre a área dele no celular." },
  { titulo: "Entra sem criar senha", desc: "Nada para instalar. Funciona no navegador." },
  { titulo: "Fixa na tela inicial, se quiser", desc: "Vira um atalho, como um aplicativo." },
];
const SEGURANCA = [
  "Cada pessoa da equipe acessa com o próprio usuário",
  "Permissões por perfil; o financeiro é só do proprietário",
  "Dados separados por academia, sem cruzamento entre clientes",
  "Histórico das ações críticas feitas no painel",
];

// As mesmas respostas da landing anterior (funcionamento real de hoje),
// separadas pelo lado de quem pergunta.
const FAQ_ACADEMIA = [
  {
    p: "Posso cadastrar meus alunos atuais?",
    r: "Sim. Os alunos são cadastrados no painel com plano, vencimento e dados de contato. Durante a implantação acompanhamos essa carga inicial junto com você.",
  },
  {
    p: "A equipe pode ter acessos diferentes?",
    r: "Sim. Cada pessoa recebe um perfil (proprietário, gerente, recepção ou instrutor) e só enxerga as seções liberadas para ele. O financeiro, por exemplo, é exclusivo do proprietário.",
  },
  {
    p: "Posso testar antes de trocar de sistema?",
    r: "A validação é feita junto com a implantação, testando os fluxos principais com a sua equipe. As condições comerciais de teste são combinadas na conversa de demonstração.",
  },
  {
    p: "Meus dados ficam separados dos de outras academias?",
    r: "Sim. Cada academia tem o próprio ambiente, com usuários, permissões e dados separados. Uma academia não enxerga informações de alunos de outra.",
  },
  {
    p: "Como solicito uma demonstração?",
    r: "Pelo botão desta página. Combinamos um horário para mostrar o sistema funcionando e entender a rotina da sua academia.",
  },
];
const FAQ_ALUNO = [
  {
    p: "O GestAcad funciona no celular?",
    r: "Sim. O painel da academia funciona no navegador do computador, tablet ou celular, e a área do aluno foi desenhada primeiro para o celular.",
  },
  {
    p: "Precisa instalar algum programa?",
    r: "Não. Tudo funciona pelo navegador, sem instalação e sem depender de um computador específico.",
  },
  {
    p: "Como funciona o QR Code de acesso?",
    r: "O aluno abre o QR Code no celular e apresenta na recepção. A equipe valida pelo painel, e o sistema confere a situação da matrícula e das mensalidades antes de registrar a entrada no histórico.",
  },
];

const INCLUSO_NO_PLANO = [
  "Gestão de alunos, planos e mensalidades",
  "Recepção com QR Code e histórico de acessos",
  "Treinos digitais e área do aluno",
  "Financeiro, retenção e relatórios",
  "Produtos, estoque e notificações",
  "Equipe com permissões por perfil",
  "Implantação acompanhada e suporte direto",
];

function Faq({ itens }: { itens: { p: string; r: string }[] }) {
  return (
    <div className="ls-faq">
      {itens.map(({ p, r }) => (
        <details key={p}>
          <summary>
            {p}
            <Plus size={16} weight="bold" aria-hidden="true" />
          </summary>
          <p>{r}</p>
        </details>
      ))}
    </div>
  );
}

function Regua() {
  return (
    <div className="ls-regua" aria-hidden="true">
      <span>A academia</span>
      <span>O aluno</span>
    </div>
  );
}

function ListaRecursos({ itens }: { itens: typeof RECURSOS_ALUNO }) {
  return (
    <ul className="ls-rec__lista" data-sc-stagger="45" data-sc-in>
      {itens.map(({ icon: Icon, titulo, desc }) => (
        <li key={titulo}>
          <Icon size={20} weight="duotone" aria-hidden="true" />
          <b>{titulo}</b>
          <span>{desc}</span>
        </li>
      ))}
    </ul>
  );
}

function Passos({ itens }: { itens: { titulo: string; desc: string }[] }) {
  return (
    <ol className="ls-passos">
      {itens.map((p, i) => (
        <li key={p.titulo}>
          <span>{i + 1}</span>
          <b>{p.titulo}</b>
          <span className="ls-body">{p.desc}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Home() {
  const ano = anoSaoPaulo();
  return (
    <div id="ls-root" className={`ls-root ${archivo.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <Espinha />
      <main id="topo">
        {/* ============================================ ATO 1 · RECONHECIMENTO
            Os dois lados da mesma academia, com a frase da marca cortada pela
            divisória. Profundidade: fundo, pessoa, névoa e superfície do
            produto em taxas diferentes (CSS lendo --sc-p). */}
        <section className="ls-hero" data-sc-act="pin" data-sc-span="1.5" aria-labelledby="ls-h1">
          <h1 id="ls-h1" className="sr-only">
            Sua academia organizada. Seus alunos mais conectados.
          </h1>
          <div data-sc-stage>
            <div className="ls-split ls-hero__split">
              <div className="ls-col ls-col--a ls-hero__col">
                <img className="ls-plano ls-plano--fundo" src={M.heroAFundo} alt="" width={1152} height={1536} fetchPriority="high" />
                <div className="ls-atmos" aria-hidden="true" />
                <div className="ls-hero__scrim" aria-hidden="true" />
                <div className="ls-superficie ls-hero__recepcao">
                  <HeroRecepcao />
                </div>
              </div>
              <div className="ls-col ls-col--b ls-hero__col">
                <img className="ls-plano ls-plano--fundo" src={M.heroBFundo} alt="" width={1152} height={1536} fetchPriority="high" />
                <div className="ls-atmos" aria-hidden="true" />
                <div className="ls-hero__scrim" aria-hidden="true" />
                <div className="ls-superficie ls-hero__celular">
                  <HeroCelular />
                </div>
              </div>
            </div>

            <div className="ls-hero__copy">
              <div className="ls-hero__cel ls-hero__cel--a">
                <p className="ls-display" aria-hidden="true">
                  Sua academia organizada.
                </p>
                <p className="ls-lede">Alunos, mensalidades, acessos, treinos e financeiro no mesmo painel.</p>
                <div className="ls-hero__acoes">
                  <a href={HREF_DEMO} {...PROPS_DEMO} className="ls-cta">
                    {ROTULO_CTA}
                    <ArrowRight size={18} weight="bold" aria-hidden="true" />
                  </a>
                  <a href="#painel" className="ls-link">
                    Ver o sistema
                  </a>
                </div>
              </div>
              <div className="ls-hero__cel ls-hero__cel--b">
                <p className="ls-display" aria-hidden="true">
                  Seus alunos mais <span className="ls-acento">conectados.</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ ATO 2 · INCÔMODO
            Silêncio antes do pico: só tipo, nenhuma mídia, e a divisória
            partida enquanto este ato está na tela. */}
        <section id="problemas" className="ls-sem scroll-mt-4" data-sc-act="flow">
          <Regua />
          <div className="ls-split">
            <div className="ls-col ls-col--a">
              <div className="ls-inner ls-inner--a" data-sc-in>
                <h2 className="ls-h2">Na recepção, tudo depende de alguém lembrar.</h2>
                <ul className="ls-sem__lista">
                  {DORES_ACADEMIA.map((d) => (
                    <li key={d.dor}>
                      {d.dor}
                      <small>{d.detalhe}</small>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="ls-col ls-col--b">
              <div className="ls-inner ls-inner--b" data-sc-in>
                <h2 className="ls-h2">No treino, tudo depende de um papel.</h2>
                <ul className="ls-sem__lista">
                  {DORES_ALUNO.map((d) => (
                    <li key={d.dor}>
                      {d.dor}
                      <small>{d.detalhe}</small>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ ATO 3 · CONEXÃO (pico)
            O único scrub da página. Cada evento sai de um lado, atravessa a
            divisória e vira uma linha real do outro (palco.ts). */}
        <section
          id="painel"
          className="ls-con"
          data-sc-act="pin"
          data-sc-span="3.4"
          aria-labelledby="ls-con-titulo"
        >
          <div data-sc-stage>
            <div className="ls-split ls-con__split">
              <div className="ls-col ls-col--a ls-con__a">
                <video
                  className="ls-loop ls-con__video ls-con__video--dono"
                  data-src={M.dono}
                  data-src-movel={M.donoMovel}
                  poster={M.donoPoster}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden="true"
                />
                <div className="ls-con__cab">
                  <h2 id="ls-con-titulo" className="ls-h2">
                    O que o aluno faz no celular, a academia vê na hora.
                  </h2>
                  <div className="ls-legendas mt-4" aria-live="polite">
                    {LEGENDAS.map((l, i) => (
                      <p key={l.inicio} data-leg={i}>
                        {l.texto}
                      </p>
                    ))}
                  </div>
                </div>
                <CartoesAcademia />
              </div>
              <div className="ls-col ls-col--b ls-con__b">
                <video
                  className="ls-loop ls-con__video"
                  data-src={M.aluna}
                  data-src-movel={M.alunaMovel}
                  poster={M.alunaPoster}
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-hidden="true"
                />
                <div className="ls-con__scrim" aria-hidden="true" />
                <CartoesAluno />
              </div>
            </div>
            <div className="ls-con__legenda-movel" aria-hidden="true">
              <div className="ls-legendas">
                {LEGENDAS.map((l, i) => (
                  <p key={l.inicio} data-leg={i}>
                    {l.texto}
                  </p>
                ))}
              </div>
            </div>
            {EVENTOS.map((ev) => (
              <span key={ev.id} className="ls-sinal" data-ev={ev.id} aria-hidden="true">
                <i />
                {ev.rotulo}
              </span>
            ))}
          </div>
        </section>

        {/* ============================================ ATO 4 · CONFIANÇA
            As duas cenas se abrem por wipe, uma de cada lado, em sentidos
            opostos, e seguem num zoom lento. */}
        <section id="funcionalidades" className="ls-rec scroll-mt-4" data-sc-act="flow">
          <Regua />
          <div className="ls-split">
            <div className="ls-col ls-col--a">
              <div className="ls-inner ls-inner--a">
                <figure className="ls-rec__midia" data-sc-reveal="up" data-sc-reveal-at="0.1 0.38">
                  <img src={M.recAPoster} alt="Dono da academia e professor revisando um treino no notebook da recepção" width={1080} height={1350} loading="lazy" />
                </figure>
                <h2 className="ls-h2 ls-rec__h2">Para quem gerencia</h2>
                <ListaRecursos itens={RECURSOS_ACADEMIA} />
              </div>
            </div>
            <div className="ls-col ls-col--b">
              <div className="ls-inner ls-inner--b">
                <figure className="ls-rec__midia" data-sc-reveal="down" data-sc-reveal-at="0.16 0.44">
                  <img src={M.recBPoster} alt="Aluna passando pela catraca da academia, à noite" width={1080} height={1350} loading="lazy" />
                </figure>
                <h2 id="aplicativo" className="ls-h2 ls-rec__h2">
                  Para quem treina
                </h2>
                <ListaRecursos itens={RECURSOS_ALUNO} />
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ ATO 5 · CALMA
            Informação administrativa, comprimida, respondida do lado de quem
            pergunta. */}
        <section id="duvidas" className="ls-duv scroll-mt-4" data-sc-act="flow">
          <Regua />
          <div className="ls-split">
            <div className="ls-col ls-col--a">
              <div className="ls-inner ls-inner--a">
                <div id="como-funciona" className="ls-bloco scroll-mt-4" data-sc-in>
                  <h2 className="ls-h2">Como começa na sua academia</h2>
                  <Passos itens={IMPLANTACAO} />
                  <p className="ls-body mt-4">
                    O GestAcad é validado junto à rotina real de academias. Preferimos mostrar o sistema
                    funcionando a exibir números que ainda não temos.
                  </p>
                </div>
                <div id="seguranca" className="ls-bloco scroll-mt-4" data-sc-in>
                  <h3 className="ls-h3">Os dados da sua academia ficam protegidos</h3>
                  <ul className="ls-seguranca">
                    {SEGURANCA.map((s) => (
                      <li key={s}>
                        <ShieldCheck size={18} weight="duotone" aria-hidden="true" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="ls-bloco" data-sc-in>
                  <h3 className="ls-h3">Perguntas de quem gerencia</h3>
                  <Faq itens={FAQ_ACADEMIA} />
                </div>
              </div>
            </div>
            <div className="ls-col ls-col--b">
              <div className="ls-inner ls-inner--b">
                <div className="ls-bloco" data-sc-in>
                  <h2 className="ls-h2">Como o aluno entra</h2>
                  <Passos itens={ACESSO_ALUNO} />
                </div>
                <div className="ls-bloco" data-sc-in>
                  <h3 className="ls-h3">Perguntas sobre o lado do aluno</h3>
                  <Faq itens={FAQ_ALUNO} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ ATO 6 · DECISÃO
            O colapso: a divisória corre para a borda e o lado do aluno vira
            o celular dentro da tela do dono. O plano e o botão ficam. */}
        <section id="planos" className="ls-fim" data-sc-act="pin" data-sc-span="2" aria-labelledby="ls-fim-titulo">
          <div data-sc-stage>
            <div className="ls-fim__cel-movel" aria-hidden="true">
              <CelularFechamento />
            </div>
            <div className="ls-fim__palco">
              <div className="ls-fim__a ls-col--a">
                <div id="contato" className="ls-fim__plano scroll-mt-4">
                  <h2 id="ls-fim-titulo" className="ls-h2">
                    Você cuida da academia. O aluno leva a academia no bolso.
                  </h2>
                  <div className="ls-fim__preco">
                    <span className="ls-body">Planos a partir de</span>
                    <strong>{PRECO_MENSAL_LABEL}</strong>
                    <span className="ls-body">/mês</span>
                  </div>
                  <p className="ls-body mt-2 max-w-[52ch]">
                    O valor acompanha a quantidade de alunos ativos e as necessidades da operação.
                  </p>
                  <ul className="ls-fim__incluso">
                    {INCLUSO_NO_PLANO.map((item) => (
                      <li key={item}>
                        <CheckCircle size={18} weight="fill" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  {linkWhatsappComercial ? (
                    <div className="ls-fim__acoes">
                      <a href={linkWhatsappComercial} target="_blank" rel="noopener noreferrer" className="ls-cta">
                        <WhatsappLogo size={18} weight="bold" aria-hidden="true" />
                        {ROTULO_CTA}
                      </a>
                    </div>
                  ) : (
                    // Sem número comercial configurado, nenhum canal é
                    // inventado: a página diz a verdade em vez de exibir um
                    // botão que não leva a lugar nenhum. Basta definir
                    // NEXT_PUBLIC_WHATSAPP_COMERCIAL para o botão aparecer.
                    <div className="ls-fim__aviso">
                      <p className="text-sm font-medium text-white">Canal de contato em configuração</p>
                      <p className="ls-fine mt-1.5">
                        O WhatsApp comercial ainda não foi configurado nesta instalação. Assim que o número for
                        definido, o botão de contato aparece aqui automaticamente.
                      </p>
                    </div>
                  )}
                  <p className="ls-fine mt-5 max-w-[60ch]">
                    O valor pode variar com a quantidade de alunos ativos, integrações e serviços contratados.
                    Integrações específicas, equipamentos de acesso, mensagens automatizadas e serviços
                    personalizados podem ter condições adicionais.
                  </p>
                </div>
                <footer className="ls-colofao">
                  <Marca tom="claro" tamanho={32} />
                  <span>© {ano} GestAcad</span>
                  <a href="/login">Entrar</a>
                  <a href="/termos">Termos de Uso</a>
                  <a href="/privacidade">Política de Privacidade</a>
                </footer>
              </div>

              <div className="ls-fim__cortina" aria-hidden="true">
                <div className="ls-fim__cortina-conteudo">
                  <CelularFechamento />
                  <p className="ls-fim__frase">O mesmo sistema, do lado de quem treina.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Motor />
      <noscript>
        <style>{`[data-sc-cue],[data-sc-in],[data-sc-stagger]>*{opacity:1!important;transform:none!important}[data-sc-reveal]{clip-path:none!important}`}</style>
      </noscript>
    </div>
  );
}
