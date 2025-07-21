const backupDatabase = require('../src/backupDatabase')

const run = async () => {
  await backupDatabase(console.log)
  console.log('Finished.')
}

run()
