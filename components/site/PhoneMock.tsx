import { LayoutGrid, Dumbbell, Wallet, User } from "lucide-react";

/**
 * Moldura de celular (não é captura real) para representar o app do aluno.
 * O conteúdo da tela é passado como `children`; a barra de status e a barra de
 * abas inferior (opcional) são desenhadas aqui.
 */
export default function PhoneMock({
  children,
  comAbas = false,
  className = "",
}: {
  children: React.ReactNode;
  comAbas?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`w-[230px] rounded-[2rem] border border-ink-600 bg-ink-900 p-2 shadow-card ${className}`}
    >
      <div className="overflow-hidden rounded-[1.6rem] bg-ink-950">
        {/* Barra de status */}
        <div className="flex items-center justify-between px-4 py-2 text-[9px] text-slate-400">
          <span className="font-medium">9:41</span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
            <span className="inline-block h-2 w-3 rounded-[2px] border border-slate-600" />
          </span>
        </div>

        <div className="px-3.5 pb-3.5">{children}</div>

        {comAbas && (
          <div className="flex items-center justify-around border-t border-ink-700/70 bg-ink-900/70 px-4 py-2.5">
            {[LayoutGrid, Dumbbell, Wallet, User].map((Icon, i) => (
              <Icon
                key={i}
                className={`h-4 w-4 ${i === 0 ? "text-volt-300" : "text-slate-600"}`}
                aria-hidden="true"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
