// E_NOTIMPL: Change *Team to *TeamId.  or *TeamNgsId?
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const uuid = require('uuid').v4
const { uniqBy } = require('lodash')
const getCompressedJson = require('./lib/getCompressedJson')
const getCosmos = require('./db/getCosmos')
const changeExtension = require('./lib/changeExtension')
const getDivisionNameParts = require('./lib/getDivisionNameParts')
const getSqlServer = require('./db/getSqlServer')
const insertRow = require('./db/insertRow')
const {
  azure: { cosmos: { matchesContainer }, storage: { account, parsedContainer } }
} = require('./config')

const getGameFingerprint = async (parsedFilesystem, season, replayKey) => {
  const processedPath = `processed/ngs/season-${`${season}`.padStart(2, 0)}/${changeExtension(replayKey, 'parse.json.gz')}`

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

const importMatch = async (parsedFilesystem, container, db, match, log) => {
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
      winner: game.winner || 'unknown' // some bad data doesn't have the winner
    })

    mapBans.push(...match.homeTeam.mapBans.map(mb => ({ matchId, map: mb, team: 'home' })))
    mapBans.push(...match.awayTeam.mapBans.map(mb => ({ matchId, map: mb, team: 'away' })))
  }

  const { division, coast } = getDivisionNameParts(match.division)

  // If we've seen this match before, get rid of it.
  await db
    .request()
    .input('ngsMatchId', match.id)
    .query('DELETE FROM Match WHERE NgsMatchId = @ngsMatchId')

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
      homeNgsTeamId: match.homeTeam.id,
      awayTeam: match.awayTeam.name,
      awayNgsTeamId: match.awayTeam.id,
      round: match.round >= 1 ? match.round : null,
      isPlayoffs: match.isPlayoffs ? 1 : 0,
      caster,
      vodLinks
    })

    for (const game of games) {
      await insertRow(txn, 'MatchGame', game)
    }

    // The data has the same ban listed twice sometimes, clean it up.
    for (const mapBan of uniqBy(mapBans, mb => `${mb.matchId}-${mb.map}-${mb.team}`)) {
      await insertRow(txn, 'MapBan', mapBan)
    }

    await txn.commit()
  } catch (err) {
    await txn.rollback()
    log(`ERROR for match ${match.id}: ${err}`)
    return false
  }

  await container.item(match.id, match.id).patch([
    { op: 'set', path: '/status/isImported', value: true }
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
    WHERE m.status.isCopied = true AND (m.status.isImported = false OR NOT ISDEFINED(m.status.isImported))`)

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const match of response.resources) {
      if (count >= maxCount) {
        break
      }

      if (await importMatch(parsedFilesystem, container, db, match, log)) {
        log(`Imported match ${match.id}.`)
        count++
      } else {
        log(`Skipped match ${match.id}.`)
      }
    }

    keepGoing = count < maxCount && response.hasMoreResults
  }

  await db.close()

  log(`Imported ${count} matches.`)

  return count
}
