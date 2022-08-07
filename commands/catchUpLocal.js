const moment = require('moment')
const findNgsTeams = require('../src/findNgsTeams')
const findNgsMatches = require('../src/findNgsMatches')
const copyNgsMatches = require('../src/copyNgsMatches')
const findStormLeagueGames = require('../src/findStormLeagueGames')
const parseReplays = require('../src/parseReplays')
const generateImports = require('../src/generateImports')
const importReplaysIntoSql = require('../src/importReplaysIntoSql')
const importNgsTeams = require('../src/importNgsTeams')
const importNgsMatches = require('../src/importNgsMatches')
const prunePendingDirectories = require('../src/prunePendingDirectories')
const { ngs: { currentSeason } } = require('../src/config')

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

const log = (msg) => {
  console.log(`${moment().format('hh:mm:ss')}: ${msg}`)
}

const run = async () => {
  log('Finding NGS teams')
  await findNgsTeams(log)
  log('Finding NGS matches')
  await findNgsMatches(currentSeason, log)
  await callUntilZero('Copying NGS matches', () => copyNgsMatches(100, () => {}), log)
  await callUntilZero('Finding Storm League games', async () => {
    const result = await findStormLeagueGames(100, () => {})
    return result.count
  }, log)
  await callUntilZero('Parsing replays', () => parseReplays(100, () => {}), log)
  await callUntilZero('Generating imports', () => generateImports(100, () => {}), log)
  await callUntilZero('Importing replays into SQL', () => importReplaysIntoSql(100, () => {}), log)
  await callUntilZero('importing NGS teams into SQL', () => importNgsTeams(100, () => {}), log)
  await callUntilZero('importing NGS matches into SQL', () => importNgsMatches(100, () => {}), log)
  log('Pruning pending directories')
  await prunePendingDirectories(log)
}

run().then(() => log('Done.'))
