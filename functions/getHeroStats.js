const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const moment = require('moment')
const getCosmos = require('../src/db/getCosmos')
const getUncompressedJson = require('../src/lib/getUncompressedJson')
const { azure: { storage: { account, configContainer }, cosmos: { heroStatsContainer } } } = require('../src/config')

let heroMap

const getHeroMap = async () => {
  if (!heroMap) {
    const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
    const configFilesystem = datalake.getFileSystemClient(configContainer)
    const heroes = await getUncompressedJson(configFilesystem, 'heroes.json')
    heroMap = {}

    for (const hero of heroes) {
      heroMap[hero.internalName] = { name: hero.name, role: hero.role }
    }
  }

  return heroMap
}

const findOrAddHeroEntry = (heroes, heroMap, internalName) => {
  const hero = heroMap[internalName]
  let entry = heroes.find(e => e.name === hero.name)

  if (!entry) {
    entry = { name: hero.name, role: hero.role, wins: 0, losses: 0 }
    heroes.push(entry)
  }

  return entry
}

module.exports = async function (request, context) {
  const headers = request.headers

  for (const header of headers.keys()) {
    console.log(`Header: ${header}=${headers.get(header)}`)
  }

  const startDate = moment(request.query.get('startDate')).format('YYYYMMDD')
  const endDate = moment(request.query.get('endDate')).format('YYYYMMDD')

  const heroMap = await getHeroMap()
  const container = await getCosmos(heroStatsContainer, false)
  const query = container.items.query(`SELECT d.date, d.heroes FROM d WHERE d.date BETWEEN "${startDate}" AND "${endDate}"`)
  let keepGoing = true

  const jsonBody = { heroes: [] }

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const item of response.resources) {
      context.log(`Adding date ${item.date}.`)
      for (const hero of item.heroes) {
        const entry = await findOrAddHeroEntry(jsonBody.heroes, heroMap, hero.name)
        entry.wins += hero.wins
        entry.losses += hero.losses
      }
    }

    keepGoing = response.hasMoreResults
  }

  for (const hero of jsonBody.heroes) {
    if (hero.wins + hero.losses > 0) {
      hero.winRate = hero.wins / (hero.wins + hero.losses)
    } else {
      hero.winRate = 0
    }

    hero.gamesPlayed = hero.wins + hero.losses
    delete hero.wins
    delete hero.losses
  }

  return {
    jsonBody
  }
}
