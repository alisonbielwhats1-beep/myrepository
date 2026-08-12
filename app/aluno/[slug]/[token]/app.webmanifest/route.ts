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

export async function GET(
  _req: Request,
  { params }: { params: { slug: string; token: string } }
) {
  const base = `/aluno/${params.slug}/${params.token}`;

  const manifest = {
    name: "GestAcad — Meu treino",
    short_name: "GestAcad",
    id: base,
    start_url: base,
    scope: base,
    display: "standalone",
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
      // Sem cache agressivo: se o aluno regenerar o link, o manifest acompanha.
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
