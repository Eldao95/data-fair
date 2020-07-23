const Ajv = require('ajv')
const ajv = new Ajv()

exports.sniff = (values, attachmentsPaths = [], existingField) => {
  console.log('sniff', existingField)
  if (existingField && existingField.ignoreDetection) return { type: 'string' }

  if (checkAll(values, isOneOf, attachmentsPaths)) return { type: 'string', 'x-refersTo': 'http://schema.org/DigitalDocument' }
  if (checkAll(values, val => booleanRegexp.test(val))) return { type: 'boolean' }
  if (checkAll(values, val => intRegexp.test(val))) return { type: 'integer' }
  if (checkAll(values, val => floatRegexp.test(val))) return { type: 'number' }
  if (checkAll(values, dateTimeSchema)) return { type: 'string', format: 'date-time' }
  if (checkAll(values, dateSchema)) return { type: 'string', format: 'date' }
  if (checkAll(values, isUriRef)) return { type: 'string', format: 'uri-reference' }
  return { type: 'string' }
}

exports.format = (value, prop) => {
  if (!value) return null
  if (typeof value !== 'string') value = JSON.stringify(value)
  if (prop.type === 'string') return value.trim()
  const cleanValue = value.replace(new RegExp(`^${trimablePrefix}`, 'g'), '').replace(new RegExp(`${trimablePrefix}$`, 'g'), '')
  if (prop.type === 'boolean') return ['1', 'true', 'vrai', 'oui', 'yes'].includes(cleanValue.toLowerCase())
  if (prop.type === 'integer' || prop.type === 'number') return Number(cleanValue.replace(/\s/g, '').replace(',', '.'))
}

exports.escapeKey = (key) => {
  key = key.replace(/\.|\s|\$|;|,|:|!|\?\//g, '_').replace(/"/g, '')
  // prefixing by _ is reserved to fields calculated by data-fair
  while (key.startsWith('_')) {
    key = key.slice(1)
  }
  return key
}

function checkAll(values, check, param) {
  const definedValues = [...values].filter(v => !!v)
  if (!definedValues.length) return false
  for (const value of definedValues) {
    if (!check(value.trim(), param)) {
      return false
    }
  }
  return true
}

// underscore is accepted and ignored around numbers and booleans
const trimablePrefix = '(\\s|_)*'

const isOneOf = (value, values) => values.includes(value)
// const isBoolean = (value) => ['0', '1', '-1', 'true', 'false'].indexOf(value.toLowerCase()) !== -1
const booleanRegexp = new RegExp(`^${trimablePrefix}(0|1|-1|true|false|vrai|faux|oui|non|yes|no)${trimablePrefix}$`, 'i')
const intRegexp = new RegExp(`^${trimablePrefix}(-|\\+)?[0-9\\s]+${trimablePrefix}$`)
const floatRegexp = new RegExp(`^${trimablePrefix}(-|\\+)?([0-9\\s]+([.,][0-9]+)?)${trimablePrefix}$`)
const dateTimeSchema = ajv.compile({ type: 'string', format: 'date-time' })
const dateSchema = ajv.compile({ type: 'string', format: 'date' })
const uriRefSchema = ajv.compile({ type: 'string', format: 'uri-reference' })
const isUriRef = (value) => value.length < 500 && uriRefSchema(value)
