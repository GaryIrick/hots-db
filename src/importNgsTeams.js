// E_NOTIMPL: Add a command to nuke a Cosmos container.
const getCosmos = require('./db/getCosmos')
const getDivisionNameParts = require('./lib/getDivisionNameParts')
const getSqlServer = require('./db/getSqlServer')
const {
  azure: { cosmos: { teamsContainer } }
} = require('./config')

const attachPlayer = async (db, teamId, playerTag, isCaptain, isAssistantCaptain, log) => {
  const playerResult = await db.request()
    .input('playerTag', playerTag)
    .query(`
        SELECT 
          bt.PlayerId 
        FROM 
          BattleTag bt
          JOIN Player p
            ON p.PlayerId = bt.PlayerId
        WHERE 
          bt.FullTag = @playerTag
          AND p.Region = 'NA'
    `)

  if (playerResult.recordset.length === 0) {
    log(`Unable to find player ${playerTag}.`)
    return undefined
  }

  const playerId = playerResult.recordset[0].PlayerId

  const result = await db.request()
    .input('teamId', teamId)
    .input('playerId', playerId)
    .input('isCaptain', isCaptain)
    .input('isAssistantCaptain', isAssistantCaptain)
    .query(`
      MERGE TeamPlayer AS tgt
      USING
      (
        SELECT @teamId, @playerId, @isCaptain, @isAssistantCaptain
      ) src(TeamId, PlayerId, IsCaptain, IsAssistantCaptain)
        ON src.TeamId = tgt.TeamId
        AND src.PlayerId = tgt.PlayerId
      WHEN MATCHED THEN
        UPDATE SET IsCaptain = src.IsCaptain, IsAssistantCaptain = src.IsAssistantCaptain
      WHEN NOT MATCHED THEN
        INSERT(TeamId, PlayerId, IsCaptain, IsAssistantCaptain)
        VALUES(src.TeamId, src.PlayerId, src.IsCaptain, src.IsAssistantCaptain)
      OUTPUT
        inserted.PlayerId
    `)

  return result.recordset[0].PlayerId
}

const importTeam = async (container, db, team, log) => {
  const division = getDivisionNameParts(team.division)
  const result = await db.request()
    .input('ngsTeamId', team.id)
    .input('name', team.name)
    .input('division', division.division)
    .input('coast', division.coast)
    .input('isActive', !!team.isActive)
    .query(`
      MERGE Team AS tgt
      USING
      (
        SELECT @name, @ngsTeamId, @division, @coast, @isActive
      ) src(Name, NgsTeamId, Division, Coast, IsActive)
        ON src.NgsTeamId = tgt.NgsTeamId
      WHEN MATCHED THEN
        UPDATE SET Name = src.Name, Division = src.Division, Coast = src.Coast, IsActive = src.IsActive
      WHEN NOT MATCHED THEN
        INSERT(TeamId, Name, NgsTeamId, Division, Coast, IsActive)
        VALUES(NEWID(), src.Name, src.NgsTeamId, src.Division, src.Coast, src.IsActive)
      OUTPUT
        inserted.TeamId
    `)

  const teamId = result.recordset[0].TeamId
  const playerIds = []

  for (const playerTag of (team.players || [])) {
    const playerId = await attachPlayer(db, teamId, playerTag, team.captain === playerTag, team.assistantCaptains.includes(playerTag), log)
    playerIds.push(playerId)
  }

  if (playerIds.length > 0) {
    await db.request()
      .input('teamId', teamId)
      .query(`
      DELETE FROM TeamPlayer
      WHERE
        TeamId = @teamId
        AND PlayerId NOT IN (${playerIds.filter(id => id).map(id => `'${id}'`).join(',')})
      `)
  } else {
    await db.request()
      .input('teamId', teamId)
      .query(`
        DELETE FROM TeamPlayer
        WHERE TeamId = @teamId
      `)
  }

  await container.item(team.id, team.id).patch([
    { op: 'set', path: '/status/isImported', value: true }
  ])
}

module.exports = async (maxCount, log) => {
  const container = await getCosmos(teamsContainer, true)
  const db = await getSqlServer()
  let count = 0
  let keepGoing = true

  const query = container.items.query(`
    SELECT t.id, t.name, t.isActive, t.division, t.players, t.captain, t.assistantCaptains
    FROM t
    WHERE t.status.isImported = false OR NOT ISDEFINED(t.status.isImported)`)

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const team of response.resources) {
      if (count >= maxCount) {
        break
      }

      await importTeam(container, db, team, log)
      log(`Imported team ${team.id} (${team.name}).`)
      count++
    }

    keepGoing = count < maxCount && response.hasMoreResults
  }

  await db.close()

  log(`Imported ${count} teams.`)

  return count
}
