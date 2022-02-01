const assert = require('assert').strict
const xlsx = require('../server/utils/xlsx')
const testUtils = require('./resources/test-utils')

describe('Spreadsheets conversions', () => {
  const checkDateDataset = async (ext) => {
    const ax = global.ax.dmeadus
    const dataset = await testUtils.sendDataset('datasets/dates.' + ext, ax)
    assert.ok(dataset.schema.find(p => p.key === 'colstr'))
    const coldate = dataset.schema.find(p => p.key === 'coldate')
    assert.ok(coldate)
    assert.equal(coldate.type, 'string')
    assert.equal(coldate.format, 'date')
    const res = await ax.get(`/api/v1/datasets/${dataset.id}/lines`)
    assert.equal(res.status, 200)
    assert.equal(res.data.total, 3)
    assert.equal(res.data.results[0].coldate, '2020-12-04')
    assert.equal(res.data.results[1].coldate, '2020-12-05')
    assert.equal(res.data.results[2].coldate, '2020-12-20')
  }

  it('should manage CSV file created by Libre Office with date col', async () => {
    await checkDateDataset('csv')
  })
  it('should manage ODS file created by Libre Office with date col', async () => {
    await checkDateDataset('ods')
  })
  it('should manage XLSX file created by Libre Office with date col', async () => {
    await checkDateDataset('xlsx')
  })

  it('should manage XLSX file create by excel', async () => {
    const csv = await xlsx.getCSV('test/resources/datasets/Les aides financières ADEME.xlsx')
    const dates = csv.split('\n').map(line => line.split(',')[2])
    assert.equal(dates[1], '2019-03-20')
    assert.equal(dates[2], '2018-04-05')
  })

  it('should manage another XLSX file created by excel', async () => {
    const csv = await xlsx.getCSV('test/resources/datasets/date-time.xlsx')
    const dates = csv.split('\n').map(line => line.split(',')[1])
    assert.equal(dates[1], '2050-01-01T00:00:00Z')
    assert.equal(dates[2], '2050-01-01T01:00:00Z')
  })
})
