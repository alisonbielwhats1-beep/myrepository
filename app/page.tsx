import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  DollarSign,
  Dumbbell,
  LogIn,
  QrCode,
  Smartphone,
  Users,
} from "lucide-react";
import Logo from "@/components/Logo";

const features = [
  {
    icon: QrCode,
    title: "Catraca por QR Code",
    desc: "Aluno gera um QR dinâmico no app e libera a catraca em segundos.",
  },
  {
    icon: Dumbbell,
    title: "Treinos com vídeo",
    desc: "Fichas montadas com demonstrações reais dos movimentos, séries e cargas.",
  },
  {
    icon: DollarSign,
    title: "Financeiro completo",
    desc: "Receitas, despesas por categoria, lucro e fluxo de caixa mensal.",
  },
  {
    icon: Users,
    title: "Multi-tenant seguro",
    desc: "Cada academia só enxerga seus próprios alunos e dados — isolamento por login.",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-ink-950 bg-grid-fade">
      {/* brilho ambiente */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-volt-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-magenta-500/10 blur-[120px]" />

      <div className="relative mx-auto flex max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="btn-volt">
              <LogIn className="h-4 w-4" /> Entrar
            </Link>
          </nav>
        </header>

        {/* Hero */}
        <section className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
          <div className="animate-fade-up">
            <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
              <Activity className="h-3.5 w-3.5" /> SaaS multi-tenant para academias
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Sua academia com cara de{" "}
              <span className="text-volt-300">app premium</span>.
            </h1>
            <p className="mt-5 max-w-md text-lg text-slate-300">
              Gestão completa de alunos, treinos, financeiro, funcionários e
              controle de catraca — cada academia com seus próprios dados,
              totalmente isolados.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-volt text-base">
                Entrar no painel <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* ilustração */}
          <div className="relative mx-auto w-full max-w-sm animate-fade-up">
            <div className="surface rounded-3xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Smartphone className="h-4 w-4 text-volt-300" /> App do aluno
                </div>
                <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
                  isolado por academia
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gradient-to-br from-volt-500/20 to-transparent p-4">
                  <Dumbbell className="h-5 w-5 text-volt-300" />
                  <div className="mt-6 text-sm font-semibold text-white">
                    Treinos
                  </div>
                  <div className="text-xs text-slate-400">
                    vídeo de demonstração
                  </div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-magenta-500/20 to-transparent p-4">
                  <BarChart3 className="h-5 w-5 text-magenta-400" />
                  <div className="mt-6 text-sm font-semibold text-white">
                    Dashboard
                  </div>
                  <div className="text-xs text-slate-400">
                    só da sua academia
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="surface rounded-2xl p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-700 text-volt-300">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </section>

        <footer className="border-t border-ink-700 py-8 text-center text-xs text-slate-500">
          AcadFlow · Next.js (App Router) · Tailwind CSS · Supabase · PWA
        </footer>
      </div>
    </main>
  );
}
