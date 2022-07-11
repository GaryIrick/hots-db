const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const getCompressedJson = require('./lib/getCompressedJson')
const getSqlServer = require('./db/getSqlServer')
const getRegion = require('./lib/getRegion')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, sqlImportContainer } }
} = require('./config')

const getPlayerId = async (db, toonHandle, name, tag) => {
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

  return playerId
}

const importPlayers = async (db, json) => {
  const playerMap = {}

  for (const player of json.teams[0].players.concat(json.teams[1].players)) {
    const { handle, name, tag } = player
    playerMap[handle] = await getPlayerId(db, handle, name, tag)
  }

  return playerMap
}

const importReplay = async (sqlImportFilesystem, blobName, db, log) => {
  log(`importing ${blobName}`)

  try {
    const json = await getCompressedJson(sqlImportFilesystem, blobName)
    const playerMap = await importPlayers(db, json)
    console.log(JSON.stringify(playerMap))

    // E_NOTIMPL: Uncomment this after code is tested
    // await moveBlob(rawFilesystem, blobName, blobName.replace('pending/', 'processed/'))
    log(`parseimported ${blobName}`)
  } catch (err) {
    // E_NOTIMPL: Uncomment this after code is tested
    // await moveBlob(sqlImportFilesystem, blobName, blobName.replace('pending/', 'error/'))
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
