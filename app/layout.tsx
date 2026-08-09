import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "./ServiceWorkerRegister";

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

export const metadata: Metadata = {
  metadataBase: new URL("https://gestacad.com.br"),
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
    url: "https://gestacad.com.br",
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

// Aplica o tema salvo ANTES da primeira pintura (evita "piscar" de tema).
const NO_FLASH_SCRIPT = `(function(){try{var t=localStorage.getItem('gestacad-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

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
        {children}
      </body>
    </html>
  );
}
