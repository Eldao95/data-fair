// An application patch is a subset of the application object
// It is the part that can be user defined and sent in a patch
// the rest is read only fields

const application = require('./application')
const patchKeys = ['configuration', 'url', 'urlDraft', 'description', 'title', 'publications', 'publicationSites', 'requestedPublicationSites', 'extras', 'topics', 'preferLargeDisplay']
module.exports = {
  title: 'Application patch',
  type: 'object',
  additionalProperties: false,
  properties: {}
}
patchKeys.forEach(k => {
  module.exports.properties[k] = application.properties[k]
})
