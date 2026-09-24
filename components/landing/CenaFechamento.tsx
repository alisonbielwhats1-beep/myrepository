import { ArrowRight, Check } from "lucide-react";
import ScrollScene from "@/components/landing/ScrollScene";
import QrDecorativo from "@/components/landing/QrDecorativo";

/**
 * Fechamento: o celular da abertura volta. O QR valida, a catraca libera e o
 * convite aparece e fica, sem sumir no rodapé. O celular acompanha o mouse de
 * leve (`data-tilt`), só em desktop e sem "reduzir movimento".
 */
export default function CenaFechamento({
  hrefWhatsapp,
}: {
  /** wa.me comercial; sem ele, a página explica que o canal está em configuração. */
  hrefWhatsapp: string | null;
}) {
  return (
    <ScrollScene id="contato" span={1.8} spanMobile={1.6} className="lp-fim" label="Contato">
      <div className="lp-fim__copy">
        <h2 className="lp-display lp-h1">
          Amanhã cedo, sua recepção <span className="text-volt-300">já pode abrir assim.</span>
        </h2>
        <p className="lp-lede">
          Conheça o GestAcad e veja como simplificar a gestão, acompanhar seus
          alunos e ter mais controle da operação.
        </p>

        <div className="lp-cue lp-fim__acao" style={{ "--a": 0.42, "--d": 0.14 } as React.CSSProperties}>
          {hrefWhatsapp ? (
            <a
              href={hrefWhatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="lp-btn lp-btn--volt lp-btn--grande"
            >
              Quero conhecer o GestAcad
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </a>
          ) : (
            // Sem número comercial configurado, nenhum canal é inventado: a
            // página diz a verdade em vez de exibir um botão que não leva a
            // lugar nenhum. Basta definir NEXT_PUBLIC_WHATSAPP_COMERCIAL.
            <div className="lp-fim__aviso">
              <p className="font-medium text-white">Canal de contato em configuração</p>
              <p className="mt-1.5 text-slate-400">
                O WhatsApp comercial ainda não foi configurado nesta instalação.
                Assim que o número for definido, o botão de contato aparece aqui
                automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="lp-fim__cena" data-tilt aria-hidden="true">
        <div className="lp-fim__phone">
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
                <p className="lp-swap__a text-[11px] text-slate-400">Validando na recepção</p>
                <p className="lp-swap__b text-[11px] font-semibold text-volt-300">Acesso liberado</p>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-catraca">
          <span className="lp-catraca__led" />
          <span className="lp-catraca__braco" />
          <span className="lp-catraca__poste" />
          <span className="lp-catraca__chao" />
        </div>
      </div>
    </ScrollScene>
  );
}
