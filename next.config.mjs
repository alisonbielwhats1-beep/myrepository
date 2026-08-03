/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Limite padrão da Server Action é 1 MB — insuficiente para o clipe de
    // demonstração do exercício (vídeo curto ou GIF, ver lib/midia-exercicios.ts).
    // 4 MB fica dentro do teto de payload de Function do Vercel (4.5 MB).
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    // Permite servir imagens de alta qualidade (fotos nativas de exercícios,
    // perfis de alunos e mídias hospedadas no Storage do Supabase) sem
    // reprocessamento/filtros — mantendo o estado original das fotos.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
      // Fotos reais e livres de direitos (domínio público) do catálogo de
      // exercícios: github.com/yuhonas/free-exercise-db (licença Unlicense).
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
