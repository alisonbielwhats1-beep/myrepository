import {
  Facebook,
  Globe,
  Instagram,
  MessageCircle,
  Music2,
} from "lucide-react";
import type { AcademiaPublica } from "@/lib/types";

/**
 * Bloco das redes sociais DA PRÓPRIA ACADEMIA na Comunidade. Os links vêm da
 * RPC pública `obter_academia_publica` (migration 084) — específicos do tenant,
 * nunca misturados entre academias. Só aparece o que a academia preencheu.
 */

type LinkRede = {
  key: string;
  label: string;
  href: string;
  Icon: typeof Instagram;
  classe: string;
};

/** Garante um href http(s) seguro a partir de um "@handle" ou de uma URL. */
function normalizarRede(
  valor: string | null,
  base: string
): string | null {
  const v = (valor ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").replace(/^\/+/, "");
  if (!handle) return null;
  return `${base}${handle}`;
}

function montarLinks(academia: AcademiaPublica): LinkRede[] {
  const links: LinkRede[] = [];

  const instagram = normalizarRede(academia.instagram, "https://instagram.com/");
  if (instagram) {
    links.push({
      key: "instagram",
      label: "Instagram",
      href: instagram,
      Icon: Instagram,
      classe: "text-magenta-400",
    });
  }

  const whatsappDigits = academia.whatsapp?.replace(/\D/g, "");
  if (whatsappDigits) {
    links.push({
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/${whatsappDigits}`,
      Icon: MessageCircle,
      classe: "text-volt-300",
    });
  }

  const site = normalizarRede(academia.site, "https://");
  if (site) {
    links.push({
      key: "site",
      label: "Site",
      href: site,
      Icon: Globe,
      classe: "text-cyanx-400",
    });
  }

  const facebook = normalizarRede(academia.facebook, "https://facebook.com/");
  if (facebook) {
    links.push({
      key: "facebook",
      label: "Facebook",
      href: facebook,
      Icon: Facebook,
      classe: "text-cyanx-400",
    });
  }

  const tiktok = normalizarRede(academia.tiktok, "https://tiktok.com/@");
  if (tiktok) {
    links.push({
      key: "tiktok",
      label: "TikTok",
      href: tiktok,
      Icon: Music2,
      classe: "text-slate-200",
    });
  }

  return links;
}

export default function RedesSociaisAcademia({
  academia,
}: {
  academia: AcademiaPublica | null;
}) {
  if (!academia) return null;
  const links = montarLinks(academia);
  if (links.length === 0) return null;

  return (
    <section className="surface rounded-2xl p-4">
      <h2 className="text-sm font-semibold text-white">{academia.nome_fantasia}</h2>
      <p className="mt-0.5 text-xs text-slate-400">Siga a academia nas redes</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {links.map(({ key, label, href, Icon, classe }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-ink-500 hover:bg-ink-700"
          >
            <Icon className={`h-4 w-4 ${classe}`} />
            {label}
          </a>
        ))}
      </div>
    </section>
  );
}
