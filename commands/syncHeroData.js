const syncHeroData = require('../src/syncHeroData')

const run = async (season) => {
  await syncHeroData(console.log)
  console.log('Finished.')
}

run()
