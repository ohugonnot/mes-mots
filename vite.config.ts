import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

/** Date de construction, affichée dans l'espace parents : « quelle version tourne ? » doit
 *  se répondre en regardant l'écran, pas en fouillant un cache de service worker. */
const VERSION_CONSTRUITE = new Date().toISOString().slice(0, 16).replace('T', ' ')

/**
 * La tablette sert l'application à la racine de son domaine. La démo publique vit sous
 * `/mes-mots/` sur GitHub Pages, et sans ce préfixe elle chercherait ses fichiers un cran
 * trop haut : page blanche, sans erreur lisible. `BASE_PUBLIQUE` n'est posé que pour elle.
 */
const BASE = process.env.BASE_PUBLIQUE ?? '/'

export default defineConfig({
  base: BASE,
  define: { __VERSION_CONSTRUITE__: JSON.stringify(VERSION_CONSTRUITE) },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icone-192.png', 'icone-512.png'],
      manifest: {
        name: 'Mes mots',
        short_name: 'Mes mots',
        description: "Application de communication",
        lang: 'fr',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f4f6f8',
        theme_color: '#14213d',
        icons: [
          { src: 'icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // les MP3 des phrases doivent être en cache : sans eux l'app est muette hors ligne
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,mp3}'],
        // un cache d'une version précédente a déjà servi un bundle disparu du disque, ce qui
        // masquait entièrement une fonction livrée : la famille resterait sur une vieille
        // version sans le savoir, et sans moyen de s'en apercevoir
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    include: ['tests/unitaires/**/*.test.ts'],
  },
})
