import { Clock, QrCode, ScanLine } from "lucide-react";
import QRCodeCard from "./QRCodeCard";

/**
 * Aba "Acesso".
 *
 * ORDEM DA TELA — por que o QR vem primeiro
 *   A versão anterior dava o herói da tela a um card DESABILITADO ("Em
 *   implementação") e escondia o QR que a recepção realmente usa atrás de um
 *   acordeão fechado. Resultado: uma das cinco abas da barra inferior gastava
 *   a tela inteira num placeholder, e a única coisa útil dela exigia um toque
 *   pra aparecer — bem na hora em que o aluno está parado na catraca.
 *
 *   Agora o QR é o herói e a promessa do check-in self-service virou uma linha
 *   discreta embaixo. A honestidade é a mesma (nada finge estar pronto), só a
 *   ênfase mudou.
 *
 * Sem QR gerado ainda, não há o que promover: aí o card "em implementação"
 * volta a ser o conteúdo principal, porque é de fato tudo o que existe.
 */
export default function AcessoView({
  academiaSlug,
  tokenQrAcesso,
  matriculaCodigo,
}: {
  academiaSlug: string;
  tokenQrAcesso: string | null;
  matriculaCodigo: string | null;
}) {
  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-slate-400">Sua entrada na academia</p>
        <h1 className="text-2xl font-bold text-white">Acesso</h1>
      </header>

      {tokenQrAcesso ? (
        <>
          <QRCodeCard
            academiaSlug={academiaSlug}
            tokenQrAcesso={tokenQrAcesso}
            matriculaCodigo={matriculaCodigo}
          />

          {/* A novidade que vem, sem roubar a tela de quem precisa entrar hoje. */}
          <div className="surface flex items-start gap-3 rounded-2xl p-4">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-ink-700 text-slate-400">
              <ScanLine className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-200">
                Em breve: check-in direto pelo app
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Por enquanto, apresente o QR acima na recepção.
              </p>
            </div>
          </div>
        </>
      ) : (
        <div className="surface relative overflow-hidden rounded-3xl p-6">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-volt-500/10 blur-3xl" />

          <div className="relative flex flex-col items-center text-center">
            {/* "QR" ilustrativo, não escaneável — sinaliza o recurso sem fingir
                que funciona. */}
            <div className="relative">
              <div className="grid h-28 w-28 place-items-center rounded-3xl border border-ink-600 bg-ink-900/60">
                <QrCode className="h-14 w-14 text-slate-600" strokeWidth={1.5} />
              </div>
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                Ainda não gerado
              </span>
            </div>

            <h2 className="mt-6 text-lg font-bold text-white">
              Seu QR de acesso ainda não existe
            </h2>
            <p className="mt-1 max-w-xs text-sm text-slate-400">
              Peça à recepção da sua academia para gerar sua credencial. Assim
              que ela existir, aparece aqui.
            </p>
            <p className="mt-5 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5" /> O check-in pelo app vem numa
              próxima atualização
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
