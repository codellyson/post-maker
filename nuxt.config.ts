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
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#000000' },
        // Link previews. The app is a client-only SPA, so these must live in the static HTML.
        { name: 'description', content: 'Today’s best few posts for your products, ready to copy: carousels, clips and close-up images with copy for Facebook, X and LinkedIn. Your team posts them by hand.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Post maker' },
        { property: 'og:title', content: 'Post maker' },
        { property: 'og:description', content: 'Today’s best few posts for your products, ready to copy.' },
        { property: 'og:url', content: 'https://postmaker.kreativekorna.com/' },
        { property: 'og:image', content: 'https://postmaker.kreativekorna.com/og.png' },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Post maker: the words post maker in giant thin type over a row of coloured post tiles.' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Post maker' },
        { name: 'twitter:description', content: 'Today’s best few posts for your products, ready to copy.' },
        { name: 'twitter:image', content: 'https://postmaker.kreativekorna.com/og.png' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Display:wght@200;300;400;600&display=swap', crossorigin: 'anonymous' },
      ],
    },
  },
})
