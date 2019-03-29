const config = require('config')
const createError = require('http-errors')

// adapt headers based on the state of the currently requested resource
// Set max-age
// Also compare last-modified and if-modified-since headers for cache revalidation on a specific resource
// only send data if the dataset was finalized since then
// prevent running expensive queries while always presenting fresh data
// also set last finalized date into last-modified header
exports.resourceBased = (req, res, next) => {
  const dateKey = req.resource.finalizedAt ? 'finalizedAt' : 'updatedAt'
  const date = (new Date(req[dateKey])).toUTCString()
  const cacheVisibility = req.user ? 'private' : 'public'

  // finalizedAt passed as query parameter is used to timestamp the query and
  // make it compatible with a longer caching, only for datasets
  if (req.query.finalizedAt) {
    const qFinalizedAt = (new Date(req.query.finalizedAt)).toUTCString()
    if (qFinalizedAt > date) {
      throw createError(400, '"finalizedAt" query parameter has a value higher than the finalizedAt attribute of the dataset.')
    }
    res.setHeader('Cache-Control', `${cacheVisibility}, max-age=${config.cache.timestampedPublicMaxAge}`)
  } else {
    res.setHeader('Cache-Control', `${cacheVisibility}, max-age=${config.cache.publicMaxAge}`)
  }

  const ifModifiedSince = req.get('If-Modified-Since')
  if (ifModifiedSince && date === ifModifiedSince) return res.status(304).send()
  res.setHeader('Last-Modified', date)
  next()
}

// cf https://stackoverflow.com/questions/12205632/express-returns-304-for-ie-repeative-requests
exports.noCache = (req, res, next) => {
  res.setHeader('Expires', '-1')
  res.setHeader('Cache-Control', 'must-revalidate, private')
  next()
}
