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
