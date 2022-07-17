const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const fastq = require('fastq')
const { orderBy, findIndex } = require('lodash')
const getCompressedJson = require('./lib/getCompressedJson')
const putCompressedJson = require('./lib/putCompressedJson')
const changeExtension = require('./lib/changeExtension')
const getHeroByInternalName = require('./lib/getHeroByInternalName')
const getRegion = require('./lib/getRegion')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, parsedContainer, sqlImportContainer, sparkImportContainer } }
} = require('./config')
const moment = require('moment')

const loopsToGameSeconds = (loops) => {
  return (loops - 610) / 16
}

const getStatsForPlayer = (parse, playerHandle) => {
  const stats = parse.players[playerHandle].gameStats
  return {
    kills: stats.SoloKill,
    assists: stats.Assists,
    deaths: stats.Deaths,
    outnumberedDeaths: stats.OutnumberedDeaths,
    timeSpentDead: stats.TimeSpentDead,
    heroDamage: stats.HeroDamage,
    siegeDamage: stats.SiegeDamage,
    healing: stats.Healing,
    damageTaken: stats.DamageTaken,
    xp: stats.ExperienceContribution,
    mercCaptures: stats.MercCampCaptures,
    enemyCcTime: stats.TimeCCdEnemyHeroes,
    enemySilenceTime: stats.TimeSilencingEnemyHeroes,
    enemyRootTime: stats.TimeRootingEnemyHeroes,
    enemyStunTime: stats.TimeStunningEnemyHeroes,
    globes: stats.RegenGlobes || 0
  }
}

const getTalentsForPlayer = (parse, playerHandle) => {
  const talents = parse.players[playerHandle].talents
  return [
    talents.Tier1Choice,
    talents.Tier2Choice,
    talents.Tier3Choice,
    talents.Tier4Choice,
    talents.Tier5Choice,
    talents.Tier6Choice,
    talents.Tier7Choice
  ]
}

const getPlayersForTeam = (parse, index) => {
  const team = parse.match.teams[`${index}`]
  const players = []

  for (let i = 0; i < 5; i++) {
    players.push({
      handle: team.ids[i],
      name: team.names[i],
      // It appears that some regions (CN) do not have tags, just names.
      tag: parse.players[team.ids[i]].tag || '0000',
      hero: team.heroes[i],
      party: parse.players[team.ids[i]].party,
      stats: getStatsForPlayer(parse, team.ids[i]),
      talents: getTalentsForPlayer(parse, team.ids[i])
    })
  }

  // This will ensure that the players are returned in pick order.
  return orderBy(players, p => findIndex(parse.match.picks[`${index}`], pick => pick === p.hero))
}

const getBansForTeam = async (parse, index) => {
  const bans = []

  // I found some replays with missing bans.
  if (parse.match.bans) {
    const banData = parse.match.bans[`${index}`]

    for (const ban of banData.filter(b => b.hero !== '')) {
      bans.push({
        round: ban.order,
        order: ban.absolute,
        hero: await getHeroByInternalName(ban.hero)
      })
    }
  }

  return orderBy(bans, b => b.absolute).map(b => b.hero)
}

const getTakedowns = (parse, allPlayers) => {
  const takedowns = []
  for (const player of allPlayers) {
    for (const death of parse.players[player.handle].deaths) {
      const takedown = {
        time: loopsToGameSeconds(death.loop),
        victim: death.victim.hero,
        killers: death.killers.map(k => k.hero)
      }
      takedowns.push(takedown)
    }
  }

  return takedowns
}

const getMessages = (parse, allPlayers) => {
  const messages = []

  for (const message of (parse.match.messages || []).filter(m => m.type === 0)) {
    messages.push({
      player: message.player,
      text: message.text,
      time: loopsToGameSeconds(message.loop)
    })
  }

  return messages
}

const getImportJson = async (parse) => {
  const { match, match: { region: regionId, version, winner, firstPickWin } } = parse
  const game = {
    fingerprint: parse.fingerprint,
    region: getRegion(regionId),
    map: match.map,
    date: moment(match.date).format('YYYY-MM-DD'),
    patch: `${version.m_major}.${version.m_minor}.${version.m_revision}.${version.m_build}`,
    length: loopsToGameSeconds(parse.match.loopLength),
    winningTeam: winner === 0 ? 1 : 2,
    firstPickTeam: firstPickWin ? (winner === 0 ? 1 : 2) : (winner === 0 ? 2 : 1)
  }

  const team1 = {
    team: 1,
    players: getPlayersForTeam(parse, 0),
    bans: await getBansForTeam(parse, 0)
  }

  const team2 = {
    team: 2,
    players: getPlayersForTeam(parse, 1),
    bans: await getBansForTeam(parse, 1)
  }

  game.teams = [team1, team2]

  const allPlayers = team1.players.concat(team2.players)
  game.takedowns = getTakedowns(parse, allPlayers)
  game.messages = getMessages(parse, allPlayers)

  return game
}

const generateImports = async ({ parsedFilesystem, sqlImportFilesystem, sparkImportFilesystem, blobName, log }) => {
  log(`starting ${blobName}`)

  try {
    // E_NOTIMPL: Can we use the same format for SQL and Spark?  Could simplify some things.
    const parse = await getCompressedJson(parsedFilesystem, blobName)
    const jsonFilename = changeExtension(blobName, 'parse.json.gz')
    const json = await getImportJson(parse)
    await putCompressedJson(sqlImportFilesystem, jsonFilename, json)
    await putCompressedJson(sparkImportFilesystem, jsonFilename, json)
    log(`generated imports for ${blobName}`)
    // E_NOTIMPL:  Once we are happy with this code, mark the file as "processed".
    // await moveBlob(parsedFilesystem, blobName, blobName.replace('pending/', 'processed/'))
  } catch (err) {
    // E_NOTIMPL:  Once we are happy with this code, mark the file as "error".
    // await moveBlob(parsedFilesystem, blobName, blobName.replace('pending/', 'error/'))
    log(`error with ${blobName}: ${err}`)
  }
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const parsedFilesystem = datalake.getFileSystemClient(parsedContainer)
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainer)
  const sparkImportFilesystem = datalake.getFileSystemClient(sparkImportContainer)
  const queue = fastq.promise(generateImports, 20)

  let keepGoing = true
  let queuedWork = false
  let count = 0

  for await (const page of parsedFilesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 100 })) {
    if (!keepGoing) {
      break
    }

    for (const item of page.pathItems) {
      if (!keepGoing) {
        break
      }

      if (!item.isDirectory) {
        queue.push({ parsedFilesystem, sqlImportFilesystem, sparkImportFilesystem, blobName: item.name, log })
        queuedWork = true

        if (++count >= maxCount) {
          keepGoing = false
        }
      }
    }
  }

  if (queuedWork) {
    // If we do this when we haven't put anything into the queue, the process stops immediately.
    // I have no idea why.
    await queue.drained()
  }

  return count
}
