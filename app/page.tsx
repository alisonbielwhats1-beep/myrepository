import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Dumbbell,
  QrCode,
  ScanLine,
  Smartphone,
} from "lucide-react";
import Logo from "@/components/Logo";
import { MOCK_ACADEMIA } from "@/lib/mock-data";

const slug = MOCK_ACADEMIA.slug_url;

const features = [
  {
    icon: QrCode,
    title: "Catraca por QR Code",
    desc: "Aluno gera um QR dinâmico no app e libera a catraca em segundos.",
  },
  {
    icon: Dumbbell,
    title: "Treinos com fotos reais",
    desc: "Fichas montadas com imagens nativas dos movimentos, séries e cargas.",
  },
  {
    icon: BarChart3,
    title: "Dashboard de BI",
    desc: "Gympass vs. Direto, horários de pico e faturamento cruzado.",
  },
  {
    icon: Smartphone,
    title: "PWA instalável",
    desc: "Experiência de app nativo, dark mode e funcionamento offline.",
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
            <Link href={`/aluno/${slug}`} className="btn-ghost">
              <Smartphone className="h-4 w-4" /> App do Aluno
            </Link>
            <Link href={`/painel/${slug}`} className="btn-volt">
              Painel <ArrowRight className="h-4 w-4" />
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
              Gestão completa de treinos, controle de catraca e inteligência de
              negócio — tudo em uma plataforma vibrante e instalável no celular.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/painel/${slug}`} className="btn-volt text-base">
                Abrir Painel da Academia <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={`/aluno/${slug}`} className="btn-ghost text-base">
                <QrCode className="h-4 w-4" /> Ver App do Aluno
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Demonstração com dados fictícios · academia{" "}
              <span className="text-slate-300">{MOCK_ACADEMIA.nome_fantasia}</span>
            </p>
          </div>

          {/* mock visual */}
          <div className="relative mx-auto w-full max-w-sm animate-fade-up">
            <div className="surface rounded-3xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <ScanLine className="h-4 w-4 text-volt-300" /> Acesso liberado
                </div>
                <span className="chip border-volt-500/30 bg-volt-500/10 text-volt-300">
                  ao vivo
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { k: "Acessos hoje", v: "128" },
                  { k: "Ativos", v: "342" },
                  { k: "MRR", v: "R$ 41k" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl bg-ink-700/60 p-3">
                    <div className="text-xl font-bold text-white">{s.v}</div>
                    <div className="text-[10px] uppercase tracking-wide text-slate-400">
                      {s.k}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gradient-to-br from-volt-500/20 to-transparent p-4">
                  <Dumbbell className="h-5 w-5 text-volt-300" />
                  <div className="mt-6 text-sm font-semibold text-white">
                    Treino A
                  </div>
                  <div className="text-xs text-slate-400">Peito e Tríceps</div>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-magenta-500/20 to-transparent p-4">
                  <BarChart3 className="h-5 w-5 text-magenta-400" />
                  <div className="mt-6 text-sm font-semibold text-white">
                    BI ativo
                  </div>
                  <div className="text-xs text-slate-400">Pico às 19h</div>
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
          GymFlow · Next.js (App Router) · Tailwind CSS · Supabase · PWA
        </footer>
      </div>
    </main>
  );
}
