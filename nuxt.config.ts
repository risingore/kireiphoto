export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    'nuxt-auth-utils'
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      title: 'kirei photo - 写真を高画質に',
      meta: [
        { name: 'description', content: 'AIで写真を高画質に変換するWebサービス。完全無料。' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  nitro: {
    preset: 'cloudflare-pages',
  },

  runtimeConfig: {
    hfSpaceUrl: '',
    public: {
      appName: 'kirei photo',
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    }
  },

  typescript: {
    strict: true,
    shim: false
  }
})
