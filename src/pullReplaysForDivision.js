const fs = require('fs')
const path = require('path')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const getCosmos = require('./db/getCosmos')
const {
  azure: { cosmos: { matchesContainer }, storage: { account, rawContainer } },
  replaysByDivisionDirectory
} = require('./config')

const copyReplayToLocal = async (rawFilesystem, season, matchId, division, replayKey, log) => {
  const azureBlobName = `processed/ngs/season-${`${season}`.padStart(2, 0)}/${replayKey}`
  const divisionDir = path.join(replaysByDivisionDirectory, division)

  if (!fs.existsSync(divisionDir)) {
    fs.mkdirSync(divisionDir)
  }

  const localPath = path.join(divisionDir, replayKey)

  if (fs.existsSync(localPath)) {
    return
  }

  const rawFileClient = rawFilesystem.getFileClient(azureBlobName)

  try {
    await rawFileClient.readToFile(localPath)
    log(`Copied ${azureBlobName}.`)
  } catch (err) {
    log(`Unable to copy ${azureBlobName} for ${matchId}: ${err}`)
  }
}

module.exports = async (season, division, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  const container = await getCosmos(matchesContainer, true)
  let count = 0
  let keepGoing = true

  const query = container.items.query(`SELECT m.id, m.games FROM m WHERE m.season = ${season} AND m.division = '${division}' AND m.status.isCopied = true`)

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const match of response.resources) {
      for (const game of match.games) {
        await copyReplayToLocal(rawFilesystem, 14, match.id, division, game.replayKey, log)
        count++
      }
    }

    keepGoing = response.hasMoreResults
  }

  log(`Copied ${count} games.`)

  return count
}
