const { DefaultAzureCredential } = require('@azure/identity')
const agent = require('superagent')
const moment = require('moment')
const findNgsTeams = require('../src/findNgsTeams')
const findNgsMatches = require('../src/findNgsMatches')
const parseReplays = require('../src/parseReplays')
const generateImports = require('../src/generateImports')
const importReplaysIntoSql = require('../src/importReplaysIntoSql')
const importNgsTeamsIntoSql = require('../src/importNgsTeamsIntosql')
const importNgsMatchesIntoSql = require('../src/importNgsMatchesIntoSql')
const prune = require('../src/prune')
const { azure: { resourceGroup, functionAppUrl, functionAppName }, ngs: { currentSeason } } = require('../src/config')

const getHostKey = async () => {
  const c = new DefaultAzureCredential()
  const { token } = await c.getToken('https://management.azure.com')
  const subscriptionId = process.env.SUBSCRIPTION_ID
  const mgmtUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Web/sites/${functionAppName}/host/default/listkeys?api-version=2022-03-01`

  const { body } = await agent
    .post(mgmtUrl)
    .set('Authorization', `Bearer ${token}`)
    .send('')

  return body.functionKeys.default
}

const callAzureFunction = async (functionName, hostKey, payload) => {
  const fullUrl = `${functionAppUrl}/${functionName}?code=${hostKey}`

  const { body } = await agent
    .post(fullUrl)
    .send(payload)

  return body.count
}

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
  const hostKey = await getHostKey()

  // Do one complete pass to pick up the NGS games first, because I am usually impatient and want the NGS data first.
  await callOnce('Finding NGS teams', () => findNgsTeams(() => {}), log)
  await callOnce('Finding NGS matches', () => findNgsMatches(currentSeason, () => {}), log)
  await callUntilZero('Copying NGS matches', () => callAzureFunction('copy-ngs-matches', hostKey, { maxCount: 100 }), log)
  await callUntilZero('Parsing replays', () => parseReplays(100, () => {}), log)
  await callUntilZero('Generating imports', () => generateImports(100, () => {}), log)
  await callUntilZero('Importing replays into SQL', () => importReplaysIntoSql(100, () => {}), log)
  await callUntilZero('importing NGS teams into SQL', () => importNgsTeamsIntoSql(100, () => {}), log)
  await callUntilZero('importing NGS matches into SQL', () => importNgsMatchesIntoSql(100, () => {}), log)

  // Now look for Storm League, and repeat the relevant parts of the process.
  await callUntilZero('Finding Storm League games', () => callAzureFunction('find-storm-league-games', hostKey, { maxCount: 100 }), log)
  await callUntilZero('Parsing replays', () => parseReplays(100, () => {}), log)
  await callUntilZero('Generating imports', () => generateImports(100, () => {}), log)
  await callUntilZero('Importing replays into SQL', () => importReplaysIntoSql(100, () => {}), log)

  // Get rid of old replay files and empty directories in the "pending" folder of each storage container.
  await callOnce('Pruning empty pending directories', () => prune(() => {}), log)
}

run().then(() => log('Done.'))
