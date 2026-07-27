import { ChevronDown } from "lucide-react";

/**
 * FAQ acessível construída com <details>/<summary> nativos: navegável por
 * teclado, expansível sem JavaScript nenhum (zero custo de client bundle) e
 * já anunciada corretamente por leitores de tela.
 *
 * Todas as respostas descrevem o funcionamento REAL do sistema hoje — nada de
 * recurso planejado apresentado como disponível.
 */
const PERGUNTAS: { p: string; r: string }[] = [
  {
    p: "O GestAcad funciona no celular?",
    r: "Sim. O painel da academia funciona no navegador do computador, tablet ou celular, e a área do aluno foi desenhada primeiro para o celular. Também pode ser instalado como atalho na tela inicial.",
  },
  {
    p: "Preciso instalar algum programa?",
    r: "Não. Tudo funciona pelo navegador, sem instalação e sem depender de um computador específico.",
  },
  {
    p: "Posso cadastrar meus alunos atuais?",
    r: "Sim. Os alunos são cadastrados no painel com plano, vencimento e dados de contato. Durante a implantação acompanhamos essa carga inicial junto com você.",
  },
  {
    p: "A equipe da academia pode ter acessos diferentes?",
    r: "Sim. Cada pessoa recebe um perfil — proprietário, gerente, recepção ou instrutor — e só enxerga as seções liberadas para aquele perfil. O financeiro, por exemplo, é exclusivo do proprietário.",
  },
  {
    p: "Como os alunos acessam?",
    r: "Cada aluno recebe um link pessoal da academia, que abre a área dele no celular sem precisar criar senha. Por lá ele consulta treinos, mensalidades, frequência e apresenta o QR Code de acesso.",
  },
  {
    p: "Como funciona o QR Code de acesso?",
    r: "O aluno abre o QR Code no celular e apresenta na recepção. A equipe valida pelo painel, e o sistema confere a situação da matrícula e das mensalidades antes de registrar a entrada no histórico.",
  },
  {
    p: "Como funciona a implantação?",
    r: "É acompanhada: entendemos a operação da sua academia, configuramos planos, usuários e permissões, e validamos os fluxos principais junto com a sua equipe antes da migração definitiva.",
  },
  {
    p: "Posso testar antes de trocar de sistema?",
    r: "A validação é feita junto com a implantação, testando os fluxos principais com a sua equipe. As condições comerciais de teste são combinadas diretamente na conversa de demonstração.",
  },
  {
    p: "Meus dados ficam separados dos dados de outras academias?",
    r: "Sim. Cada academia tem seu próprio ambiente, com usuários, permissões e dados separados — uma academia não enxerga informações de alunos de outra.",
  },
  {
    p: "Como solicito uma demonstração?",
    r: "Use o botão de demonstração nesta página. Combinamos um horário para mostrar o sistema funcionando e entender a rotina da sua academia.",
  },
];

export default function FaqLista() {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-ink-700/60 overflow-hidden rounded-2xl border border-ink-600/60 bg-ink-900/40">
      {PERGUNTAS.map(({ p, r }) => (
        <details key={p} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left text-sm font-medium text-white transition hover:bg-ink-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt-500/50 [&::-webkit-details-marker]:hidden">
            {p}
            <ChevronDown
              className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </summary>
          <p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{r}</p>
        </details>
      ))}
    </div>
  );
}
