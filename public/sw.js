// Service Worker do GestAcad — cache básico "app shell" para suporte offline.
//
// v2: a versão anterior fazia cache-first para QUALQUER requisição que não
// fosse navegação de página inteira — inclusive as buscas de dados que o
// Next.js faz ao trocar de aba dentro do app (RSC / navegação client-side,
// o caminho normal ao tocar na barra inferior do app instalado). Resultado:
// a primeira visita a uma tela ficava presa em cache pra sempre, e o aluno
// via dados desatualizados mesmo depois de o dono mudar o treino — o app
// "não atualizava". Cache-first agora só vale para os assets com hash no
// nome (/_next/static/...), que nunca mudam de conteúdo sob a mesma URL;
// todo o resto (RSC, API, dados) é network-first, igual à navegação normal.
const CACHE = "gestacad-v2";
const APP_SHELL = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Network-first para navegação; cache como fallback offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Assets do build (JS/CSS) trazem hash no nome do arquivo — o conteúdo sob
  // essa URL nunca muda, então cache-first é seguro e mais rápido.
  const ehAssetImutavelDoBuild = new URL(request.url).pathname.startsWith(
    "/_next/static/"
  );
  if (ehAssetImutavelDoBuild) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // Tudo mais — inclusive as buscas de dados que o Next.js faz ao trocar de
  // aba dentro do app (RSC) e chamadas de API — é dado que muda, então
  // precisa ser network-first igual à navegação normal. Sem isso, a
  // primeira visita a uma tela ficava presa em cache pra sempre.
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
