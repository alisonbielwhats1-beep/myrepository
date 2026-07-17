"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, QrCode, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AlunoTabBar({ base }: { base: string }) {
  const pathname = usePathname();

  const tabs = [
    { href: base, label: "Acesso", icon: QrCode, exact: true },
    { href: `${base}/treinos`, label: "Treinos", icon: Dumbbell, exact: false },
    { href: `${base}/perfil`, label: "Perfil", icon: User, exact: false },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md">
      <div className="m-3 flex items-center justify-around rounded-2xl border border-ink-600/70 bg-ink-800/90 p-1.5 shadow-card backdrop-blur-lg">
        {tabs.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition",
                active
                  ? "bg-volt-300/15 text-volt-300"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <t.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
