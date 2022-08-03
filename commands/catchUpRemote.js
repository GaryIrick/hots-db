const agent = require('superagent')
const moment = require('moment')
const { DefaultAzureCredential } = require('@azure/identity')
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

const log = (msg) => {
  console.log(`${moment().format('hh:mm:ss')}: ${msg}`)
}

const run = async () => {
  const hostKey = await getHostKey()
  log('Finding NGS matches')
  await callAzureFunction('find-ngs-matches', hostKey, { season: currentSeason })
  await callUntilZero('Copying NGS matches', () => callAzureFunction('copy-ngs-matches', hostKey, { maxCount: 100 }), log)
  await callUntilZero('Finding Storm League games', () => callAzureFunction('find-storm-league-games', hostKey, { maxCount: 100 }), log)
  await callUntilZero('Parsing replays', () => callAzureFunction('parse-replays', hostKey, { maxCount: 100 }, log))
  await callUntilZero('Generating imports', () => callAzureFunction('generate-imports', hostKey, { maxCount: 100 }), log)
}

run().then(() => log('Done.'))
