// Service Worker do GestAcad — PWA instalável.
//
// REGRA DE SEGURANÇA (Prompt 14/16): cachear SOMENTE arquivos estáticos
// públicos. NUNCA cachear respostas autenticadas, tokens, endpoints de Auth,
// dados do Supabase, dados pessoais (treinos, avaliações, mensalidades,
// pagamentos, presenças). Nada de "modo offline" para operações que dependem
// do servidor. Por isso:
//   - navegações (páginas) usam NETWORK-ONLY, com fallback a uma casca pública
//     só quando offline. A resposta da navegação NUNCA é gravada no cache
//     (poderia conter conteúdo do painel/aluno autenticado).
//   - só assets estáticos públicos do próprio domínio (/icons, /videos,
//     /_next/static, manifest) entram no cache, com cache-first.
//   - requisições cross-origin (ex.: Supabase) são ignoradas pelo SW.
const CACHE = "gestacad-v2";
const CASCA_PUBLICA = ["/", "/manifest.json"];

// Só estes prefixos de PATH podem ser cacheados. Tudo mais passa direto.
const PREFIXOS_ESTATICOS = ["/_next/static/", "/icons/", "/videos/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CASCA_PUBLICA)).catch(() => {})
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

function ehEstaticoPublico(url) {
  if (url.pathname === "/manifest.json") return true;
  return PREFIXOS_ESTATICOS.some((p) => url.pathname.startsWith(p));
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Cross-origin (Supabase, provedores OAuth, etc.): fora do escopo do SW.
  if (url.origin !== self.location.origin) return;

  // Navegações: network-only. Nunca grava a resposta no cache (pode ser
  // conteúdo autenticado). Offline -> casca pública mínima, só para não deixar
  // a tela em branco; não é uma versão "offline" do painel.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/").then((r) => r || Response.error())
      )
    );
    return;
  }

  // Assets estáticos públicos: cache-first (com atualização em segundo plano).
  if (ehEstaticoPublico(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const rede = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copia = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copia)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || rede;
      })
    );
    return;
  }

  // Qualquer outra coisa (APIs, rotas dinâmicas, dados): direto para a rede,
  // sem cache.
});
