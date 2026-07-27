import Image from "next/image";
import { iniciaisNome, temFotoValida } from "@/lib/aluno-classificacao";
import { cn } from "@/lib/utils";

/**
 * Avatar do aluno com fallback de iniciais quando não há foto — evita o
 * "buraco" visual de uma tag <img> quebrada quando foto_perfil_url é nulo.
 */
export default function AvatarAluno({
  nome,
  fotoUrl,
  size = 48,
  className,
}: {
  nome: string;
  fotoUrl: string | null;
  size?: number;
  className?: string;
}) {
  if (temFotoValida(fotoUrl)) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full ring-2 ring-volt-300/40",
          className
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src={fotoUrl as string}
          alt={nome}
          fill
          sizes={`${size}px`}
          className="media-native object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-ink-700 font-bold text-volt-300 ring-2 ring-volt-300/40",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-label={nome}
      role="img"
    >
      {iniciaisNome(nome)}
    </div>
  );
}
