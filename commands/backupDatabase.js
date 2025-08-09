const moment = require('moment')
const backupDatabase = require('../src/backupDatabase')

const log = (msg) => {
  console.log(`${moment().format('hh:mm:ss')}: ${msg}`)
}

const run = async () => {
  console.log('Starting backup.')
  await backupDatabase(log)
  console.log('Finished backup.')
}

run()
