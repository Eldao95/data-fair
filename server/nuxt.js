const config = require('config')

module.exports = async () => {
  if (config.proxyNuxt) {
    // in dev mode the nuxt dev server is already running, we re-expose it
    console.log('PROXU NYX ?')
    return {
      render: require('http-proxy-middleware').createProxyMiddleware({
        target: 'http://localhost:3000/data-fair/'
        // pathRewrite: { '^/data-fair': '' }
      })
    }
  } else if (process.env.NODE_ENV === 'test') {
    // no UI during tests
    return { render: (req, res, next) => next() }
  } else {
    const { Nuxt } = require('nuxt-start')
    const nuxtConfig = require('../nuxt.config.js')

    // Prepare nuxt for rendering and serving UI
    nuxtConfig.dev = false
    const nuxt = new Nuxt(nuxtConfig)
    return {
      render: async (req, res, next) => {
        // force buffering (necessary for caching) of this response in the reverse proxy
        res.setHeader('X-Accel-Buffering', 'yes')

        // re-apply the prefix that was removed by our reverse proxy in prod configs
        req.url = (nuxtConfig.router.base + req.url).replace('//', '/')
        nuxt.render(req, res)
      },
      instance: nuxt
    }
  }
}
