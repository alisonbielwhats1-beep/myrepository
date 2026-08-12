// Manifest POR ALUNO — faz o app instalado abrir DIRETO na área dele.
//
// Por que existe: no iPhone, o app adicionado à tela inicial ganha um
// armazenamento separado do Safari. Então não dá para depender do token
// guardado no aparelho (localStorage) — o app abriria "vazio" e cairia na tela
// inicial. Aqui o próprio manifest já leva `start_url` para
// `/aluno/<slug>/<token>`, então o ícone abre na ficha do aluno sem login e sem
// memória de dispositivo. Vale para iPhone e Android.
//
// A página do aluno referencia este manifest via `generateMetadata` no layout,
// sobrescrevendo o manifest global (que aponta para /inicio).
//
// DISPLAY por plataforma (evita o aviso "app de risco" do Android):
// quando o Android trata o site como "instalável" (display standalone), ele
// empacota um WebAPK, e aí o Play Protect pode bloquear com "app criado para uma
// versão mais antiga do Android" (a versão do pacote é definida pelo Chrome do
// aparelho, não por nós — não dá para corrigir pelo site). Servindo
// `display: browser` só para o Android, ele deixa de empacotar e vira um ATALHO:
// nada de WebAPK, nada de Play Protect, nenhum aviso. O atalho continua abrindo
// direto na ficha do aluno; a única diferença é a barra do Chrome no topo.
// O iPhone recebe `display: standalone` normalmente (lá não existe WebAPK, então
// não há aviso, e o app abre em tela cheia como antes).

export async function GET(
  req: Request,
  { params }: { params: { slug: string; token: string } }
) {
  const base = `/aluno/${params.slug}/${params.token}`;
  const ehAndroid = /Android/i.test(req.headers.get("user-agent") ?? "");

  const manifest = {
    name: "GestAcad — Meu treino",
    short_name: "GestAcad",
    id: base,
    start_url: base,
    scope: base,
    // Android -> atalho (sem WebAPK, sem aviso); demais -> app em tela cheia.
    display: ehAndroid ? "browser" : "standalone",
    orientation: "portrait",
    background_color: "#07080d",
    theme_color: "#07080d",
    lang: "pt-BR",
    categories: ["health", "fitness", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // O conteúdo varia pelo aparelho (Android x resto): impede um cache de
      // servir a versão errada para a outra plataforma.
      Vary: "User-Agent",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
