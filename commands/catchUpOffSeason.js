const moment = require('moment')
const findStormLeagueGames = require('../src/findStormLeagueGames')
const parseReplays = require('../src/parseReplays')
const generateImports = require('../src/generateImports')
const importReplaysIntoSql = require('../src/importReplaysIntoSql')
const prune = require('../src/prune')

const callUntilZero = async (name, fn, log) => {
  log(`${name}`)
  let keepGoing = true
  let total = 0

  while (keepGoing) {
    try {
      const count = await fn()
      total += count
      log(`${name} (${total})`)

      if (count === 0) {
        keepGoing = false
      }
    } catch (e) {
      log(`ERROR: ${e}`)
    }
  }
}

const callOnce = async (name, fn, log) => {
  log(`${name}`)

  try {
    const count = await fn()
    log(`${name} (${count})`)
  } catch (e) {
    log(`ERROR: ${e}`)
  }
}

const log = (msg) => {
  console.log(`${moment().format('hh:mm:ss')}: ${msg}`)
}

const run = async () => {
  await callUntilZero('Finding Storm League games', () => findStormLeagueGames(500, () => {}), log)
  await callUntilZero('Parsing replays', () => parseReplays(500, () => {}), log)
  await callUntilZero('Generating imports', () => generateImports(100, () => {}), log)
  await callUntilZero('Importing replays into SQL', () => importReplaysIntoSql(100, () => {}), log)

  // Get rid of old replay files and empty directories in the "pending" folder of each storage container.
  await callOnce('Pruning empty pending directories', () => prune(() => {}), log)
}

run().then(() => log('Done.'))
