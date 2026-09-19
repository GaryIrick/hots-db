const fs = require('fs')
const path = require('path')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const createWorkQueue = require('./lib/createWorkQueue')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')
const streamToBuffer = require('./lib/streamToBuffer')
const {
  azure: { storage: { account, rawContainer, configContainer } },
  cacheDirectory
} = require('./config')

const mostRecentFilename = 'heroes-profile-most-recent.txt'

const getMostRecent = async (configFilesystem) => {
  try {
    const mostRecentFileClient = configFilesystem.getFileClient(mostRecentFilename)
    const response = await mostRecentFileClient.read()
    const contents = await streamToBuffer(response.readableStreamBody)
    return Number(contents)
  } catch (e) {
    return 1
  }
}

const saveMostRecent = async (configFilesystem, mostRecent) => {
  const mostRecentFileClient = configFilesystem.getFileClient(mostRecentFilename)
  await mostRecentFileClient.upload(Buffer.from(`${mostRecent}`))
}

const copyReplayToAzure = async ({ rawFilesystem, game, log }) => {
  const blobPath = `pending/hp/${Math.floor(game.replayID / 10000)}/${game.replayID}.StormReplay`
  let replay

  try {
    replay = await getFromHeroesProfile('download/replay', { replayID: game.replayID }, true)
  } catch (err) {
    console.log(err.message)
    // 403 means the replay is outside the retention window.
    if (err.status === 403 || err.status === 404) {
      return
    } else {
      throw err
    }
  }

  const fileClient = rawFilesystem.getFileClient(blobPath)
  await fileClient.upload(replay)
  const cachedFilename = `${cacheDirectory}/replays/${blobPath}`
  fs.mkdirSync(path.dirname(cachedFilename), { recursive: true })
  fs.writeFileSync(cachedFilename, replay)
  log(`copied ${blobPath}`)
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const configFilesystem = datalake.getFileSystemClient(configContainer)
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  let mostRecent = await getMostRecent(configFilesystem)
  // Queue size is small since we will get 429's if we do more at once.
  const queue = createWorkQueue(5, copyReplayToAzure)

  let keepGoing = true
  let count = 0

  while (keepGoing) {
    const { replays: games } = await getFromHeroesProfile('replays', {
      after: mostRecent,
      game_type: 'sl'
    })

    if (games.length > 0) {
      log(`found ${games.length} replays from ${mostRecent}`)

      for (const game of games) {
        mostRecent = game.replayID

        if (game.downloadable) {
          if (game.game_type !== 'Storm League') {
            throw new Error(`Replay ${game.replayID} has game_type of ${game.game_type}.`)
          }

          queue.enqueue({ rawFilesystem, game, log })
        }

        if (++count >= maxCount) {
          keepGoing = false
          break
        }
      }
    } else {
      keepGoing = false
    }
  }

  await queue.drain()

  await saveMostRecent(configFilesystem, mostRecent)

  return count
}
