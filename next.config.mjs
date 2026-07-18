/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
