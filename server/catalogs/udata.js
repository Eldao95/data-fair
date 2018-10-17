const config = require('config')
const url = require('url')
const axios = require('axios')
const filesUtils = require('../utils/files')
const moment = require('moment')
const journals = require('../utils/journals')

exports.title = 'uData'
exports.description = 'Customizable and skinnable social platform dedicated to (open)data.'
exports.docUrl = 'https://udata.readthedocs.io/en/latest/'

exports.init = async (catalogUrl) => {
  const siteInfo = (await axios.get(url.resolve(catalogUrl, 'api/1/site/'))).data
  return { url: catalogUrl, title: siteInfo.title }
}

exports.listDatasets = async (catalog, p) => {
  const params = { page_size: 1000 }
  let datasets
  if (catalog.organization) {
    datasets = (await axios.get(url.resolve(catalog.url, 'api/1/me/org_datasets'), { params, headers: { 'X-API-KEY': catalog.apiKey } })).data
  } else {
    datasets = (await axios.get(url.resolve(catalog.url, 'api/1/me/datasets'), { headers: { 'X-API-KEY': catalog.apiKey } })).data
  }
  return { count: datasets.length, results: datasets.map(d => ({ id: d.id, title: d.title, page: d.page, url: d.uri, resources: d.resources.map(r => ({ id: r.id, format: r.format, mime: r.mime, title: r.title, url: r.url })), private: d.private })) }
}

exports.harvestDataset = async (catalog, datasetId, req) => {
  const res = await axios.get(url.resolve(catalog.url, 'api/1/datasets/' + datasetId), { headers: { 'X-API-KEY': catalog.apiKey } })
  const dataset = res.data
  const resources = dataset.resources.filter(r => filesUtils.allowedTypes.has(r.mime))
  for (const resource of resources) {
    await importResourceAsDataset(dataset, resource, catalog, req)
  }
  return resources.map(r => ({ id: r.id, format: r.format, mime: r.mime, title: r.title, url: r.url }))
}

exports.suggestOrganizations = async (catalogUrl, q) => {
  const res = await axios.get(url.resolve(catalogUrl, 'api/1/organizations/suggest/'), { params: { q } })
  return { results: res.data.map(o => ({ id: o.id, name: o.name })) }
}

exports.suggestDatasets = async (catalogUrl, q) => {
  const res = await axios.get(url.resolve(catalogUrl, 'api/1/datasets/suggest/'), { params: { q } })
  return { results: res.data.map(o => ({ id: o.id, title: o.title })) }
}

exports.publishDataset = async (catalog, dataset, publication) => {
  if (publication.addToDataset && publication.addToDataset.id) return addResourceToDataset(catalog, dataset, publication)
  else return createNewDataset(catalog, dataset, publication)
}

exports.deleteDataset = async (catalog, dataset, publication) => {
  if (publication.addToDataset && publication.addToDataset.id) return deleteResourceFromDataset(catalog, dataset, publication)
  else return deleteDataset(catalog, dataset, publication)
}

exports.publishApplication = async (catalog, application, publication, datasets) => {
  const udataDatasets = []
  datasets.forEach(dataset => {
    (dataset.publications || []).forEach(publication => {
      if (publication.catalog === catalog.id && publication.status === 'published') {
        udataDatasets.push(publication.result)
      }
    })
  })
  const udataReuse = {
    title: application.title,
    description: appPageDesc(application),
    private: true,
    type: 'application',
    url: `${config.publicUrl}/app/${application.id}`,
    extras: {
      datafairOrigin: config.publicUrl,
      datafairApplicationId: application.id
    },
    datasets: udataDatasets.map(d => ({ id: d.id }))
  }
  if (catalog.organization && catalog.organization.id) {
    udataReuse.organization = { id: catalog.organization.id }
  }
  try {
    const res = await axios.post(url.resolve(catalog.url, 'api/1/reuses/'), udataReuse, { headers: { 'X-API-KEY': catalog.apiKey } })
    publication.targetUrl = res.data.page
    publication.result = res.data
  } catch (err) {
    if (err.response) throw new Error(`Erreur lors de l'envoi à ${catalog.url} : ${JSON.stringify(err.response.data, null, 2)}`)
    else throw err
  }
}

exports.deleteApplication = async (catalog, application, publication) => {
  const udataReuse = publication.result
  // The dataset was never really created in udata
  if (!udataReuse) return
  try {
    await axios.delete(url.resolve(catalog.url, `api/1/reuses/${udataReuse.id}/`), { headers: { 'X-API-KEY': catalog.apiKey } })
  } catch (err) {
    // The reuse was already deleted ?
    if (!err.response || ![404, 410].includes(err.response.status)) throw err
  }
}

function datasetPageUrl(dataset) {
  return `${config.publicUrl}/dataset/${dataset.id}/description`
}

function datasetPageDesc(dataset) {
  const desc = dataset.description ? dataset.description + '\n\n' : ''
  const url = datasetPageUrl(dataset)
  return desc + `Ce jeu de données a été publié depuis [${config.publicUrl}](${config.publicUrl}). Consultez [sa page](${url}) pour accéder à sa description détaillée, prévisualisation, documentation d'API, etc.`
}

function appPageDesc(app) {
  const desc = app.description ? app.description + '\n\n' : ''
  const url = `${config.publicUrl}/application/${app.id}/description`
  return desc + `Cette application a été publiée depuis [${config.publicUrl}](${config.publicUrl}). Consultez [sa page](${url}) pour accéder à sa description détaillée, documentation d'API, etc.`
}

async function addResourceToDataset(catalog, dataset, publication) {
  // TODO: no equivalent of "private" on a resource
  const resources = [{
    title: `${dataset.title} - Page sur ${config.publicUrl}`,
    description: datasetPageDesc(dataset),
    url: datasetPageUrl(dataset),
    filetype: 'remote',
    format: 'Page Web',
    mime: 'text/html',
    extras: {
      datafairOrigin: config.publicUrl,
      datafairDatasetId: dataset.id
    }
  }, {
    title: `Fichier ${dataset.originalFile.mimetype.split('/').pop()}`,
    description: `Téléchargez le fichier complet au format ${dataset.originalFile.mimetype.split('/').pop()}.`,
    url: `${config.publicUrl}/api/v1/datasets/${dataset.id}/raw`,
    type: 'main',
    filetype: 'remote',
    format: 'fichier',
    filesize: dataset.file.size,
    mime: dataset.file.mimetype,
    extras: {
      datafairOrigin: config.publicUrl,
      datafairDatasetId: dataset.id
    }
  }]
  try {
    for (let resource of resources) {
      await axios.post(url.resolve(catalog.url, `api/1/datasets/${publication.addToDataset.id}/resources/`), resource, { headers: { 'X-API-KEY': catalog.apiKey } })
    }
    const udataDataset = (await axios.get(url.resolve(catalog.url, `api/1/datasets/${publication.addToDataset.id}`))).data
    publication.targetUrl = udataDataset.page
    publication.result = udataDataset
  } catch (err) {
    if (err.response) throw new Error(`Erreur lors de l'envoi à ${catalog.url} : ${JSON.stringify(err.response.data, null, 2)}`)
    else throw err
  }
}

async function createNewDataset(catalog, dataset, publication) {
  const udataDataset = {
    title: dataset.title,
    description: datasetPageDesc(dataset),
    private: true,
    extras: {
      datafairOrigin: config.publicUrl,
      datafairDatasetId: dataset.id
    },
    resources: [{
      title: `Description des champs`,
      description: `Description détaillée et types sémantiques des champs`,
      url: `${config.publicUrl}/dataset/${dataset.id}/description`,
      type: 'documentation',
      filetype: 'remote',
      format: 'Page Web',
      mime: 'text/html',
      extras: {
        datafairEmbed: 'fields'
      }
    }, {
      title: `Documentation de l'API`,
      description: `Documentation interactive de l'API à destination des développeurs. La description de l'API utilise la spécification [OpenAPI 3.0.1](https://github.com/OAI/OpenAPI-Specification)`,
      url: `${config.publicUrl}/dataset/${dataset.id}/api`,
      type: 'documentation',
      filetype: 'remote',
      format: 'Page Web',
      mime: 'text/html',
      extras: {
        apidocUrl: `${config.publicUrl}/api/v1/datasets/${dataset.id}/api-docs.json`
      }
    }, {
      title: 'Consultez les données',
      description: `Consultez directement les données dans ${dataset.bbox ? 'une carte interactive' : 'un tableau'}.`,
      url: `${config.publicUrl}/dataset/${dataset.id}/${dataset.bbox ? 'map' : 'tabular'}`,
      type: 'main',
      filetype: 'remote',
      extras: {
        datafairEmbed: dataset.bbox ? 'map' : 'table'
      }
    }, {
      title: `Fichier ${dataset.originalFile.name.split('.').pop()}`,
      description: `Téléchargez le fichier complet au format ${dataset.originalFile.name.split('.').pop()}.`,
      url: `${config.publicUrl}/api/v1/datasets/${dataset.id}/raw`,
      type: 'main',
      filetype: 'remote',
      filesize: dataset.originalFile.size,
      mime: dataset.originalFile.mimetype
    }]
  }
  if (dataset.file.mimetype !== dataset.originalFile.mimetype) {
    udataDataset.resources.push({
      title: `Fichier ${dataset.file.name.split('.').pop()}`,
      description: `Téléchargez le fichier complet au format ${dataset.file.name.split('.').pop()}.`,
      url: `${config.publicUrl}/api/v1/datasets/${dataset.id}/convert`,
      type: 'main',
      filetype: 'remote',
      filesize: dataset.file.size,
      mime: dataset.file.mimetype
    })
  }
  if (catalog.organization && catalog.organization.id) {
    udataDataset.organization = { id: catalog.organization.id }
  }
  try {
    const res = await axios.post(url.resolve(catalog.url, 'api/1/datasets/'), udataDataset, { headers: { 'X-API-KEY': catalog.apiKey } })
    if (!res.data.page || typeof res.data.page !== 'string') {
      throw new Error(`Erreur lors de l'envoi à ${catalog.url} : le format de retour n'est pas correct.`)
    }
    publication.targetUrl = res.data.page
    publication.result = res.data
  } catch (err) {
    if (err.response) throw new Error(`Erreur lors de l'envoi à ${catalog.url} : ${JSON.stringify(err.response.data, null, 2)}`)
    else throw err
  }
}

async function deleteResourceFromDataset(catalog, dataset, publication) {
  const udataDataset = publication.result
  // The dataset was never really created in udata
  if (!udataDataset) return
  const resources = (udataDataset.resources || []).filter(resource => {
    return resource.extras && resource.extras.datafairDatasetId === dataset.id
  })
  for (let resource of resources) {
    try {
      await axios.delete(url.resolve(catalog.url, `api/1/datasets/${udataDataset.id}/resources/${resource.id}/`), { headers: { 'X-API-KEY': catalog.apiKey } })
    } catch (err) {
      // The resource was already deleted ?
      if (!err.response || ![404, 410].includes(err.response.status)) throw err
    }
  }
}

async function deleteDataset(catalog, dataset, publication) {
  const udataDataset = publication.result
  // The dataset was never really created in udata
  if (!udataDataset) return
  try {
    await axios.delete(url.resolve(catalog.url, `api/1/datasets/${udataDataset.id}/`), { headers: { 'X-API-KEY': catalog.apiKey } })
  } catch (err) {
    // The dataset was already deleted ?
    if (!err.response || ![404, 410].includes(err.response.status)) throw err
  }
}

async function importResourceAsDataset(dataset, resource, catalog, req) {
  const date = moment().toISOString()
  const newDataset = {
    id: dataset.slug + '-' + resource.title.split('.').shift(),
    title: dataset.title + '-' + resource.title.split('.').shift(),
    owner: catalog.owner,
    permissions: [],
    remoteFile: {
      url: resource.url,
      catalogId: catalog.id
    },
    createdBy: { id: catalog.owner.id, name: catalog.owner.name },
    createdAt: date,
    updatedBy: { id: catalog.owner.id, name: catalog.owner.name },
    updatedAt: date,
    status: 'remote'
  }
  // if (!baseTypes.has(req.file.mimetype)) {
  //   // we first need to convert the file in a textual format easy to index
  //   dataset.status = 'uploaded'
  // } else {
  //   // The format of the original file is already well suited to workers
  //   dataset.status = 'loaded'
  //   dataset.file = dataset.originalFile
  //   const fileSample = await datasetFileSample(dataset)
  //   dataset.file.encoding = chardet.detect(fileSample)
  // }

  await req.app.get('db').collection('datasets').insertOne(newDataset)
  // const storageRemaining = await datasetUtils.storageRemaining(req.app.get('db'), owner, req)
  // if (storageRemaining !== -1) res.set(config.headers.storedBytesRemaining, storageRemaining)
  await journals.log(req.app, newDataset, { type: 'dataset-created', href: config.publicUrl + '/dataset/' + newDataset.id }, 'dataset')
}
