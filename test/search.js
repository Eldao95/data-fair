const assert = require('assert').strict
const testUtils = require('./resources/test-utils')
const workers = require('../server/workers')

describe('search', () => {
  it('Get lines in dataset', async () => {
    const ax = global.ax.dmeadus
    const dataset = await testUtils.sendDataset('datasets/dataset1.csv', ax)
    // Update schema to specify geo point
    const locProp = dataset.schema.find(p => p.key === 'loc')
    locProp['x-refersTo'] = 'http://www.w3.org/2003/01/geo/wgs84_pos#lat_long'
    let res = await ax.patch('/api/v1/datasets/' + dataset.id, { schema: dataset.schema })
    assert.equal(res.status, 200)
    await workers.hook('finalizer')
    res = await ax.get('/api/v1/datasets/dataset1/lines')
    assert.equal(res.data.total, 2)

    // Filter on keyword field
    res = await ax.get('/api/v1/datasets/dataset1/lines?q=koumoul')
    assert.equal(res.data.total, 1)
    // Filter on keyword field and child text field
    res = await ax.get('/api/v1/datasets/dataset1/lines?q=Koumoul')
    assert.equal(res.data.total, 1)
    // Filter on text field
    res = await ax.get('/api/v1/datasets/dataset1/lines?q=lactée')
    assert.equal(res.data.total, 1)
    // Filter on text field with default french stemming
    res = await ax.get('/api/v1/datasets/dataset1/lines?q=lacté')
    assert.equal(res.data.total, 1)
    // filter on exact values with query params suffixed with _in
    res = await ax.get('/api/v1/datasets/dataset1/lines?id_in=koumoul')
    assert.equal(res.status, 200)
    assert.equal(res.data.total, 1)
    try {
      res = await ax.get('/api/v1/datasets/dataset1/lines?BADFIELD_in=koumoul')
    } catch (err) {
      assert.equal(err.status, 400)
    }

    // filter on geo info
    res = await ax.get('/api/v1/datasets/dataset1/lines?bbox=-2.5,40,3,47')
    assert.equal(res.data.total, 1)
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=-2.75,47.7,10km')
    assert.equal(res.data.total, 1)
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=-2.75:47.7:10km')
    assert.equal(res.data.total, 1)
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=-2.74,47.7,1')
    assert.equal(res.data.total, 0)
    // geo_distance without a distance means distance=0 so it is a contains
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=-2.748526,47.687375')
    assert.equal(res.data.total, 1)
    // sort on distance
    res = await ax.get('/api/v1/datasets/dataset1/lines?sort=_geo_distance:2.6:45.5')
    assert.equal(res.data.results[0].id, 'bidule')
    res = await ax.get('/api/v1/datasets/dataset1/lines?sort=-_geo_distance:2.6:45.5')
    assert.equal(res.data.results[0].id, 'koumoul')
    // geo_distance filter makes the default sort a distance sort
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=2.6,45.5,1000km')
    assert.equal(res.data.total, 2)
    assert.equal(res.data.results[0].id, 'bidule')
    res = await ax.get('/api/v1/datasets/dataset1/lines?geo_distance=-2.748526,47.687375,1000km')
    assert.equal(res.data.total, 2)
    assert.equal(res.data.results[0].id, 'koumoul')

    res = await ax.get('/api/v1/datasets/dataset1/geo_agg?bbox=-3,47,-2,48')
    assert.equal(res.status, 200)
    assert.equal(res.data.aggs.length, 1)
    res = await ax.get('/api/v1/datasets/dataset1/geo_agg?bbox=-3,45,3,48')
    assert.equal(res.status, 200)
    assert.equal(res.data.aggs.length, 2)
    res = await ax.get('/api/v1/datasets/dataset1/lines?xyz=63,44,7')
    assert.equal(res.data.total, 1)
    res = await ax.get('/api/v1/datasets/dataset1/lines?xyz=63,44,7&format=geojson')
    assert.equal(res.data.total, 1)
    assert.equal(res.data.features.length, 1)
    assert.ok(res.data.features[0].geometry)
    res = await ax.get('/api/v1/datasets/dataset1/lines?xyz=63,44,7&format=pbf&q=koumoul')
    assert.equal(res.status, 200)
    assert.equal(res.headers['content-type'], 'application/x-protobuf')
    res = await ax.get('/api/v1/datasets/dataset1/lines?xyz=3,4,7&format=pbf')
    assert.equal(res.status, 204)

    // CSV export
    res = await ax.get('/api/v1/datasets/dataset1/lines?format=csv')
    let lines = res.data.split('\n')
    assert.equal(lines[0].trim(), '"id","adr","some date","loc","bool"')
    assert.equal(lines[1], '"koumoul","19 rue de la voie lactée saint avé","2017-12-12","47.687375,-2.748526",0')
    locProp.title = 'Localisation'
    await ax.patch('/api/v1/datasets/' + dataset.id, { schema: dataset.schema })
    res = await ax.get('/api/v1/datasets/dataset1/lines?format=csv')
    lines = res.data.split('\n')
    assert.equal(lines[0].trim(), '"id","adr","some date","loc","bool"')
    assert.equal(lines[1], '"koumoul","19 rue de la voie lactée saint avé","2017-12-12","47.687375,-2.748526",0')
    res = await ax.get('/api/v1/datasets/dataset1/lines?format=csv&sep=;')
    lines = res.data.split('\n')
    assert.equal(lines[0].trim(), '"id";"adr";"some date";"loc";"bool"')
  })

  it('search lines and collapse on field', async () => {
    const ax = global.ax.dmeadus
    await testUtils.sendDataset('datasets/collapsable.csv', ax)

    let res = await ax.get('/api/v1/datasets/collapsable/lines')
    assert.equal(res.data.total, 10)

    res = await ax.get('/api/v1/datasets/collapsable/lines?collapse=group&size=2&page=2')
    assert.equal(res.data.totalCollapse, 4)
    assert.equal(res.data.total, 10)
    assert.equal(res.data.results[0].group, 'group3')
    assert.equal(res.data.results[0].groupLabel, 'group 3')
  })
})
