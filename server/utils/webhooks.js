const axios = require('axios')
const config = require('config')
const ua = require('universal-analytics')
const settingsSchema = require('../../contract/settings')
const notifications = require('./notifications')
const permissions = require('./permissions')
const debug = require('debug')('webhooks')

exports.trigger = async (db, type, resource, event) => {
  const eventKey = resource.draftReason ? `${type}-draft-${event.type}` : `${type}-${event.type}`
  const eventType = settingsSchema.properties.webhooks.items.properties.events.items.oneOf
    .find(eventType => eventType.const === eventKey)
  if (!eventType) return debug('Unknown webhook event type', type, event.type)
  // first send notifications before actual webhooks
  const sender = { ...resource.owner }
  delete sender.role
  const notif = {
    sender,
    topic: { key: `data-fair:${eventKey}:${resource.id}` },
    title: eventType.title,
    // body: event.data || '',
    body: event.body || resource.title || resource.id,
    urlParams: { id: resource.id },
    visibility: permissions.isPublic(type + 's', resource) ? 'public' : 'private',
  }
  if (event.data) notif.body += ' - ' + event.data
  notifications.send(notif)

  const settings = await db.collection('settings').findOne({ id: resource.owner.id, type: resource.owner.type }) || {}
  settings.webhooks = settings.webhooks || []
  for (const webhook of settings.webhooks) {
    if (webhook.events && webhook.events.length && !webhook.events.includes(`${type}-${event.type}`)) return
    debug(`Trigger webhook for event ${event.type}`, webhook)

    const href = `${config.publicUrl}/api/v1/${type}s/${resource.id}`
    try {
      // Simple HTTP POST (mattermost, etc.)
      if (webhook.target.type === 'http') {
        let text = (resource.title || resource.id) + ' - ' + eventType.title + (event.href ? ' - ' + event.href : '')
        if (event.data) text += '\n\n' + event.data
        await axios.post(webhook.target.params.url, {
          text,
          href,
          event: event.type,
        })
      }

      // Google analytics
      // DEPRECATED, remove later
      if (webhook.target.type === 'ga') {
        const visitor = ua(webhook.target.params.trackingId)
        visitor.set('appName', webhook.target.params.appName)
        visitor.set('appVersion', webhook.target.params.appVersion)

        await new Promise((resolve, reject) => {
          let label = resource.title
          if (event.data) label += '\n\n' + event.data
          visitor.event(type, eventType.title, label, err => {
            if (err) reject(err)
            else resolve()
          })
        })
      }
    } catch (err) {
      console.log('Failure to send Webhook', webhook, err)
    }
  }
}
