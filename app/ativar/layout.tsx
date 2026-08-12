import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ui/ThemeToggle";

/** Moldura centralizada das telas de ativação (mesmo visual do login). */
export default function AtivarLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-ink-950 bg-grid-fade px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-volt-500/10 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="surface rounded-3xl p-7 shadow-card">{children}</div>
      </div>
    </main>
  );
}
