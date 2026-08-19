import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import GateRecuperacaoSenha from "@/components/auth/GateRecuperacaoSenha";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Fallback de todas as rotas (a landing sobrescreve em app/page.tsx). Mesmo
// título e descrição, para a marca aparecer igual em qualquer compartilhamento.
const TITULO_SEO = "GestAcad | Sistema de gestão para academias";
const DESCRICAO_SEO =
  "Gerencie alunos, mensalidades, acessos, treinos, financeiro e resultados da sua academia em uma única plataforma.";

// Origem pública canônica do site (metadataBase + og:url). Mesma variável que
// lib/site-url.ts e lib/actions/auth.ts já usam, para os links compartilhados,
// o app do aluno e o e-mail de reset apontarem todos para a MESMA origem. Sem
// NEXT_PUBLIC_SITE_URL, cai na URL de produção que a Vercel injeta sozinha
// (VERCEL_PROJECT_PRODUCTION_URL) — que é um domínio que existe — e só então no
// domínio final. Assim o preview de compartilhamento nunca aponta para um
// domínio sem DNS.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://gestacad.com.br");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO_SEO,
  description: DESCRICAO_SEO,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GestAcad",
  },
  openGraph: {
    title: TITULO_SEO,
    description: DESCRICAO_SEO,
    url: SITE_URL,
    siteName: "GestAcad",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_SEO,
    description: DESCRICAO_SEO,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07080d" },
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
  ],
  width: "device-width",
  initialScale: 1,
  // `maximumScale: 1` e `userScalable: false` foram removidos: bloqueavam o
  // zoom em todo o app (falha de acessibilidade — WCAG 1.4.4 exige ampliar
  // até 200%). Nada além disso muda: largura e escala inicial seguem iguais,
  // então painel, login e área do aluno continuam abrindo do mesmo jeito.
};

// Aplica o tema ANTES da primeira pintura (evita "piscar" de tema). O
// preferencial do app é o ESCURO: sem escolha salva, começa em 'dark' — nunca
// segue a preferência clara do aparelho. Só fica claro quando o usuário
// escolheu 'light' explicitamente. data-theme sempre carimbado, então o CSS
// nunca cai no caso "sem tema".
const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('gestacad-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-ink-950 font-sans antialiased">
        <ServiceWorkerRegister />
        {/* Rede de segurança do link de "Esqueci minha senha": reconhece o
            retorno de recuperação em qualquer página e leva para a tela de nova
            senha, mesmo que o Supabase caia no Site URL (a home). */}
        <GateRecuperacaoSenha />
        {children}
      </body>
    </html>
  );
}
