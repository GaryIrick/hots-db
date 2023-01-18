const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { SecretClient } = require('@azure/keyvault-secrets')
const { Storage } = require('@google-cloud/storage')
const createWorkQueue = require('./lib/createWorkQueue')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')
const streamToBuffer = require('./lib/streamToBuffer')
const {
  azure: { keyVault, storage: { account, rawContainer, configContainer } },
  google: { credentialsSecretName }
} = require('./config')

const mostRecentFilename = 'heroes-profile-most-recent.txt'

const getGoogleStorage = async () => {
  const vaultUrl = `https://${keyVault}.vault.azure.net`
  const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
  const secret = await secretClient.getSecret(credentialsSecretName)
  const creds = JSON.parse(secret.value)
  const googleProjectId = creds.project_id
  const credentials = {
    client_email: creds.client_email,
    private_key: creds.private_key
  }
  const googleStorage = new Storage({ credentials })
  return { googleStorage, googleProjectId }
}

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

const crackUrl = (url) => {
  const storageMatch = (url || '').match(/https:\/\/storage\.cloud\.google\.com\/(.*)\/(.*)/)

  if (storageMatch && storageMatch.length === 3) {
    return {
      bucket: storageMatch[1],
      file: storageMatch[2]
    }
  } else {
    return undefined
  }
}

const copyReplayToAzure = async ({ rawFilesystem, googleStorage, googleProjectId, game, log }) => {
  const googleLocation = crackUrl(game.url)

  if (!googleLocation) {
    return
  }

  const { bucket, file } = googleLocation
  const blobPath = `pending/hp/${Math.floor(game.replayID / 10000)}/${game.replayID}-${file}`
  let replay

  try {
    const googleReadStream = googleStorage.bucket(bucket).file(file).createReadStream({ userProject: googleProjectId })

    replay = await streamToBuffer(googleReadStream)
  } catch (err) {
    console.log(err.message)
    if (err.code === 404) {
      return
    } else {
      throw err
    }
  }

  const fileClient = rawFilesystem.getFileClient(blobPath)
  await fileClient.upload(replay)
  log(`copied ${blobPath}`)
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const configFilesystem = datalake.getFileSystemClient(configContainer)
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  const { googleStorage, googleProjectId } = await getGoogleStorage()
  let mostRecent = await getMostRecent(configFilesystem)
  const queue = createWorkQueue(50, copyReplayToAzure)

  let keepGoing = true
  let count = 0

  while (keepGoing) {
    const games = await getFromHeroesProfile('Replay/Min_id', {
      min_id: mostRecent + 1,
      game_type: 'Storm League'
    })

    if (games.length > 0) {
      log(`found ${games.length} replays from ${mostRecent}`)

      for (const game of games) {
        mostRecent = game.replayID

        if (game.valid && !game.deleted) {
          if (game.game_type !== 'Storm League') {
            throw new Error(`Replay ${game.replayID} has game_type of ${game.game_type}.`)
          }

          queue.enqueue({ rawFilesystem, googleStorage, googleProjectId, game, log })
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

  return { count, mostRecent }
}
