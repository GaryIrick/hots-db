// E_NOTIMPL: Do this in a transaction.
// E_NOTIMPL: Make sure there is an index for every FK relationship.
// E_NOTIMPL: Add additional indexes, but only after we have a lot of data so we can validate them.
// E_NOTIMPL: Write code to purge old directories when they are empty.
// E_NOTIMPL: Write code to move directories back from "pending" to "processed".  Probably
//            need to be smart, if the old directory doesn't exist it's one move, if the
//            old directory does exist, have to move 1-file-at-1-time.
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const uuid = require('uuid').v4
const { padStart } = require('lodash')
const insertRow = require('./db/insertRow')
const getCompressedJson = require('./lib/getCompressedJson')
const getSqlServer = require('./db/getSqlServer')
const getRegion = require('./lib/getRegion')
const getHeroId = require('./lib/getHeroId')
const getTalentId = require('./lib/getTalentId')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, sqlImportContainer } }
} = require('./config')

const getPatchSortable = (patch) => {
  const parts = patch.split('.')

  return parts[0] + padStart(parts[1], 4, '0') + padStart(parts[2], 4, '0') + padStart(parts[3], 7, '0')
}

const playerCache = {}

const getPlayerId = async (db, toonHandle, name, tag) => {
  const cacheKey = `${toonHandle}-${name}-${tag}`

  if (!playerCache[cacheKey]) {
    const region = getRegion(Number(toonHandle.substring(0, toonHandle.indexOf('-'))))

    const result = await db.request()
      .input('toonHandle', toonHandle)
      .input('region', region)
      .input('name', name)
      .input('tag', tag)
      .query(`
      MERGE Player AS tgt
      USING
      (
        SELECT @toonHandle, @region, @name, @tag
      ) src (ToonHandle, Region, Name, Tag)
        ON src.ToonHandle = tgt.ToonHandle
      WHEN MATCHED THEN
        UPDATE SET Name = src.Name, Tag = src.Tag
      WHEN NOT MATCHED THEN
        INSERT(PlayerId, ToonHandle, Region, Name, Tag)
        VALUES(NEWID(), src.ToonHandle, src.Region, src.Name, src.Tag)
      OUTPUT
        inserted.PlayerId
    `)

    const playerId = result.recordset[0].PlayerId

    await db.request()
      .input('playerId', playerId)
      .input('name', name)
      .input('tag', tag)
      .query(`
        MERGE BattleTag as tgt
        USING 
        (
          SELECT @playerId, @name, @tag
        ) as src (PlayerId, Name, Tag)
        ON tgt.PlayerId = src.PlayerId AND tgt.Name = src.Name AND tgt.Tag = src.Tag
        WHEN MATCHED THEN
            UPDATE SET LastSeen = GETUTCDATE()
        WHEN NOT MATCHED THEN 
            INSERT(PlayerId, Name, Tag, LastSeen) 
            VALUES(src.PlayerId, src.Name, src.Tag, GETUTCDATE());
    `)

    playerCache[cacheKey] = playerId
  }

  return playerCache[cacheKey]
}

const importPlayers = async (db, json) => {
  const playerMap = {}

  for (const player of json.teams[0].players.concat(json.teams[1].players)) {
    const { handle, name, tag } = player
    playerMap[handle] = await getPlayerId(db, handle, name, tag)
  }

  return playerMap
}

const importGame = async (db, json, source, playerMap) => {
  // If we've seen this game before, get rid of it.
  await db
    .request()
    .input('fingerprint', json.fingerprint)
    .query('DELETE FROM Game WHERE Fingerprint = @fingerprint')

  const gameId = uuid()

  await insertRow(db, 'Game', {
    gameId,
    fingerprint: json.fingerprint,
    source,
    patchSortable: getPatchSortable(json.patch),
    region: json.region,
    map: json.map,
    date: json.date,
    firstPickTeam: json.firstPickTeam,
    winningTeam: json.winningTeam,
    length: json.length
  })

  for (const teamIndex of [0, 1]) {
    for (const ban of json.teams[teamIndex].bans) {
      await insertRow(db, 'Ban', {
        gameId,
        team: teamIndex + 1,
        round: ban.round,
        banOrder: ban.order,
        heroId: await getHeroId(db, ban.hero)
      })
    }
  }

  for (const takedown of json.takedowns) {
    await insertRow(db, 'Takedown', {
      takedownId: uuid(),
      gameId,
      victimId: await getHeroId(db, takedown.victim),
      time: takedown.time,
      killer1Id: await getHeroId(db, takedown.killers[0]),
      killer2Id: await getHeroId(db, takedown.killers[1]),
      killer3Id: await getHeroId(db, takedown.killers[2]),
      killer4Id: await getHeroId(db, takedown.killers[3]),
      killer5Id: await getHeroId(db, takedown.killers[4])
    })
  }

  for (const teamIndex of [0, 1]) {
    for (let playerIndex = 0; playerIndex < json.teams[teamIndex].players.length; playerIndex++) {
      const player = json.teams[teamIndex].players[playerIndex]
      await insertRow(db, 'Boxscore', {
        gameId,
        playerId: playerMap[player.handle],
        heroId: await getHeroId(db, player.hero),
        team: teamIndex + 1,
        pickOrder: playerIndex + 1,
        party: player.party,
        kills: player.stats.kills,
        assists: player.stats.assists,
        deaths: player.stats.deaths,
        outnumberedDeaths: player.stats.outnumberedDeaths,
        timeSpentDead: player.stats.timeSpentDead,
        heroDamage: player.stats.heroDamage,
        siegeDamage: player.stats.siegeDamage,
        healing: player.stats.healing,
        damageTaken: player.stats.damageTaken,
        xp: player.stats.xp,
        mercCaptures: player.stats.mercCaptures,
        enemyCcTime: player.stats.enemyCcTime,
        enemySilenceTime: player.stats.enemySilenceTime,
        enemyRootTime: player.stats.enemyRootTime,
        enemyStunTime: player.stats.enemyStunTime,
        globes: player.stats.globes,
        talent1Id: await getTalentId(db, player.hero, player.talents[0], 1),
        talent2Id: await getTalentId(db, player.hero, player.talents[1], 2),
        talent3Id: await getTalentId(db, player.hero, player.talents[2], 3),
        talent4Id: await getTalentId(db, player.hero, player.talents[3], 4),
        talent5Id: await getTalentId(db, player.hero, player.talents[4], 5),
        talent6Id: await getTalentId(db, player.hero, player.talents[5], 6),
        talent7Id: await getTalentId(db, player.hero, player.talents[6], 7)
      })
    }
  }

  for (let i = 0; i < json.messages.length; i++) {
    const message = json.messages[i]
    await insertRow(db, 'ChatMessage', {
      gameId,
      playerId: playerMap[message.player],
      messageOrder: i + 1,
      time: message.time,
      message: message.text
    })
  }
}

const importReplay = async (sqlImportFilesystem, blobName, db, log) => {
  log(`importing ${blobName}`)

  try {
    const source = blobName.split('/')[1]
    const json = await getCompressedJson(sqlImportFilesystem, blobName)
    const playerMap = await importPlayers(db, json)
    await importGame(db, json, source, playerMap)

    await moveBlob(sqlImportFilesystem, blobName, blobName.replace('pending/', 'processed/'))
    log(`imported ${blobName}`)
  } catch (err) {
    await moveBlob(sqlImportFilesystem, blobName, blobName.replace('pending/', 'error/'))
    log(`error with ${blobName}: ${err}`)
  }
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainer)
  const db = await getSqlServer()

  let keepGoing = true
  let count = 0

  for await (const page of sqlImportFilesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 100 })) {
    if (!keepGoing) {
      break
    }

    for (const item of page.pathItems) {
      if (!keepGoing) {
        break
      }

      if (!item.isDirectory) {
        await importReplay(sqlImportFilesystem, item.name, db, log)

        if (++count >= maxCount) {
          keepGoing = false
        }
      }
    }
  }

  await db.close()

  return count
}
