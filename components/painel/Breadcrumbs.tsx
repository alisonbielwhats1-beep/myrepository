import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

export interface Migalha {
  label: string;
  href?: string;
}

/** Trilha de navegação — mostra onde o usuário está e permite voltar. */
export default function Breadcrumbs({
  slug,
  items,
}: {
  slug: string;
  items: Migalha[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      <Link
        href={`/painel/${slug}`}
        className="flex items-center gap-1 text-slate-500 transition hover:text-slate-300"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-slate-500 transition hover:text-slate-300"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-slate-200">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
