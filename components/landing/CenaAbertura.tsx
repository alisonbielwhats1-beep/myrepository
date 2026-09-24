import { ArrowRight, Check, ChevronRight, Dumbbell, Wallet } from "lucide-react";
import ScrollScene from "@/components/landing/ScrollScene";
import QrDecorativo from "@/components/landing/QrDecorativo";

/**
 * Abertura em camadas: fundo (a academia), título, aluna, celular e
 * atmosfera, cada plano com uma velocidade própria sob o scroll. O título fica
 * sempre legível; a aluna passa à frente só da borda dele. No celular a
 * composição é outra (título em cima, aluna e celular embaixo).
 *
 * As fotos são decorativas (aria-hidden): toda a informação está no texto.
 */
export default function CenaAbertura({
  hrefDemo,
  propsDemo,
}: {
  hrefDemo: string;
  propsDemo: { target?: "_blank"; rel?: string };
}) {
  return (
    <ScrollScene
      id="topo"
      span={1.75}
      spanMobile={1.45}
      className="lp-hero"
      label="Apresentação"
    >
      {/* Plano 1: a academia (fundo) */}
      <div className="lp-hero__back" aria-hidden="true">
        <div className="lp-hero__photo lp-hero__photo--back" />
      </div>

      {/* Plano 2: o título, entre o fundo e a aluna */}
      <div className="lp-hero__copy">
        <p className="lp-eyebrow">Sistema de gestão para academias</p>
        <h1 className="lp-display lp-hero__title">
          Sua academia em ordem, <span className="text-volt-300">do caixa à catraca.</span>
        </h1>
        <p className="lp-hero__sub">
          Alunos, mensalidades, acessos e treinos em um só lugar. E o aluno
          acompanha tudo pelo celular.
        </p>
        <div className="lp-hero__ctas">
          <a href={hrefDemo} {...propsDemo} className="lp-btn lp-btn--volt">
            Quero conhecer o GestAcad
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
          <a href="#painel" className="lp-btn lp-btn--ghost">
            Ver o sistema
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Plano 3: a aluna (recorte com transparência) */}
      <div className="lp-hero__subject" aria-hidden="true">
        <div className="lp-hero__photo lp-hero__photo--subject" />
      </div>

      {/* Plano 4: o celular e os avisos, na frente de tudo */}
      <div className="lp-hero__front" aria-hidden="true">
        <div className="lp-hero__phone">
          <div className="lp-phone">
            <div className="lp-phone__bar">
              <span>6:58</span>
              <span className="lp-phone__notch" />
            </div>
            <div className="lp-phone__body">
              <p className="text-[10px] text-slate-500">Academia Movimento</p>
              <p className="lp-display text-[15px] leading-tight text-white">Olá, Marina</p>
              <div className="lp-hero__qr">
                <QrDecorativo className="lp-hero__qr-code" />
                <div className="lp-hero__qr-ok">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-volt-300 text-ink-950">
                    <Check className="h-6 w-6" strokeWidth={3} />
                  </span>
                </div>
              </div>
              <div className="lp-swap">
                <p className="lp-swap__a text-[11px] text-slate-400">
                  Aproxime o QR Code do leitor
                </p>
                <p className="lp-swap__b text-[11px] font-semibold text-volt-300">
                  Acesso liberado · mensalidade em dia
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-hero__card lp-hero__card--treino">
          <span className="lp-hero__card-icon">
            <Dumbbell className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[11px] text-slate-400">Treino de hoje</span>
            <span className="block text-sm font-semibold text-white">Costas + bíceps</span>
          </span>
        </div>
        <div className="lp-hero__card lp-hero__card--pago">
          <span className="lp-hero__card-icon">
            <Wallet className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-[11px] text-slate-400">Mensalidade de setembro</span>
            <span className="block text-sm font-semibold text-white">Paga em 05/09</span>
          </span>
        </div>
      </div>

      {/* Plano 5: atmosfera e o piso que funde a cena na próxima */}
      <div className="lp-hero__haze" aria-hidden="true" />
      <div className="lp-hero__floor" aria-hidden="true" />
    </ScrollScene>
  );
}
