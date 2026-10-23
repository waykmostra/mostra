/** @type {import('next').NextConfig} */
const nextConfig = {
  // NB : pas de `output: 'standalone'` — incompatible avec `next start` (le script
  // `npm run start`) et inutile sur Vercel, qui gère son propre packaging.
  reactStrictMode: true,

  experimental: {
    // Vidéos jusqu'à 500 MB via server actions.
    serverActions: {
      bodySizeLimit: '500mb',
    },
    // Pas de cache routeur pour les pages dynamiques : après une validation, la
    // vue d'ensemble doit refléter l'étape réelle, pas un rendu vieux de 30 s.
    staleTimes: {
      dynamic: 0,
    },
    // Tree-shake les imports « barrel » pour alléger les bundles client.
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@dnd-kit/core',
      'date-fns',
    ],
  },
}

module.exports = nextConfig
