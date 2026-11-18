import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  nitro: {
    preset: 'cloudflare_module',
    // The queue consumer and the daily cron live in server/plugins/worker.ts.
    cloudflare: { deployConfig: false, nodeCompat: true },
  },
  css: ['~/assets/css/main.css', '~/assets/css/visual.css'],
  vite: { plugins: [tailwindcss()] },
  app: {
    head: {
      title: 'Post maker',
      htmlAttrs: { lang: 'en' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }, { name: 'theme-color', content: '#000000' }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Display:wght@200;300;400;600&display=swap', crossorigin: 'anonymous' },
      ],
    },
  },
})
