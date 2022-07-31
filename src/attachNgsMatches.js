// E_NOTIMPL: Add tables for NGS teams.
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const uuid = require('uuid').v4
const { capitalize } = require('lodash')
const getCompressedJson = require('./lib/getCompressedJson')
const getCosmos = require('./db/getCosmos')
const changeExtension = require('./lib/changeExtension')
const getSqlServer = require('./db/getSqlServer')
const insertRow = require('./db/insertRow')
const {
  azure: { cosmos: { matchesContainer }, storage: { account, parsedContainer } }
} = require('./config')

const getDivisionNameParts = (divisionName) => {
  if (divisionName.includes('-')) {
    const parts = divisionName.split('-')

    return {
      division: capitalize(parts[0]),
      coast: capitalize(parts[1])
    }
  } else {
    return {
      division: capitalize(divisionName),
      coast: null
    }
  }
}

const getGameFingerprint = async (parsedFilesystem, season, replayKey) => {
  const processedPath = `processed/ngs/season-${season}/${changeExtension(replayKey, 'parse.json.gz')}`

  try {
    const parse = await getCompressedJson(parsedFilesystem, processedPath)
    return parse.fingerprint
  } catch (err) {
    // This game has not been parsed yet.
    return undefined
  }
}

const getGameIdFromFingerprint = async (db, fingerprint) => {
  const result = await db.request()
    .input('fingerprint', fingerprint)
    .query('SELECT GameId FROM Game WHERE Fingerprint = @fingerprint')

  if (result.recordset.length > 0) {
    return result.recordset[0].GameId
  } else {
    // This game has not been imported to SQL Server yet.
    return undefined
  }
}

const attachMatch = async (parsedFilesystem, container, db, match, log) => {
  const games = []
  const mapBans = []
  const matchId = uuid()

  for (let i = 0; i < match.games.length; i++) {
    const game = match.games[i]
    const fingerprint = await getGameFingerprint(parsedFilesystem, match.season, game.replayKey)

    if (!fingerprint) {
      return false
    }

    const gameId = await getGameIdFromFingerprint(db, fingerprint)

    if (!gameId) {
      return false
    }

    games.push({
      matchId,
      gameNumber: i + 1,
      replayKey: game.replayKey,
      gameId,
      winner: game.winner
    })

    mapBans.push(...match.homeTeam.mapBans.map(mb => ({ matchId, map: mb, team: 'home' })))
    mapBans.push(...match.awayTeam.mapBans.map(mb => ({ matchId, map: mb, team: 'away' })))
  }

  const { division, coast } = getDivisionNameParts(match.division)

  const txn = db.transaction()
  await txn.begin()
  const caster = match.caster && match.caster.length > 0 ? match.caster : null
  const vodLinks = match.vodLinks && match.vodLinks.length > 0 ? match.vodLinks.join(',') : null

  try {
    await insertRow(txn, 'Match', {
      matchId,
      ngsMatchId: match.id,
      season: match.season,
      division,
      coast,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      round: match.round,
      isPlayoffs: match.isPlayoffs ? 1 : 0,
      caster,
      vodLinks
    })

    for (const game of games) {
      await insertRow(txn, 'MatchGame', game)
    }

    for (const mapBan of mapBans) {
      await insertRow(txn, 'MapBan', mapBan)
    }
    await txn.commit()
  } catch (err) {
    await txn.rollback()
    log(`ERROR for match ${match.id}: ${err}`)
    return false
  }

  await container.item(match.id, match.id).patch([
    { op: 'set', path: '/status/isAttached', value: true }
  ])

  return true
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const parsedFilesystem = datalake.getFileSystemClient(parsedContainer)
  const container = await getCosmos(matchesContainer, true)
  const db = await getSqlServer()
  let count = 0
  let keepGoing = true

  const query = container.items.query(`
    SELECT m.id, m.season, m.division, m.round, m.isPlayoffs, m.games, m.homeTeam, m.awayTeam, m.caster, m.vodLinks
    FROM m 
    WHERE m.status.isCopied = true AND (m.status.isAttached = false OR NOT ISDEFINED(m.status.isAttached))`)

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const match of response.resources) {
      if (count >= maxCount) {
        break
      }

      if (await attachMatch(parsedFilesystem, container, db, match, log)) {
        log(`Attached match ${match.id}.`)
        count++
      } else {
        log(`Skipped match ${match.id}.`)
      }
    }

    keepGoing = count < maxCount && response.hasMoreResults
  }

  await db.close()

  log(`Attached ${count} matches.`)

  return count
}
