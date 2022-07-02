const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { SecretClient } = require('@azure/keyvault-secrets')
const AWS = require('aws-sdk')
const getFromHeroesProfile = require('./apis/getFromHeroesProfile')
const streamToBuffer = require('./lib/streamToBuffer')
const {
  azure: { keyVault, storage: { account, rawContainer, configContainer } },
  aws: { credentialsSecretName }
} = require('./config')

const mostRecentFilename = 'most-recent.txt'

const getS3 = async () => {
  const vaultUrl = `https://${keyVault}.vault.azure.net`
  const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
  const secret = await secretClient.getSecret(credentialsSecretName)
  const creds = JSON.parse(secret.value)
  AWS.config.credentials = new AWS.Credentials(creds.accessKeyId, creds.secretAccessKey)
  const s3 = new AWS.S3()

  return s3
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
  const s3Match = (url || '').match(/([a-z-]+)\.s3.*\.amazonaws\.com\/(.*)/)

  if (s3Match && s3Match.length === 3) {
    return {
      bucket: s3Match[1],
      key: s3Match[2]
    }
  } else {
    return undefined
  }
}

const copyReplayToAzure = async (rawFilesystem, s3, game, log) => {
  const s3Location = crackUrl(game.url)

  if (!s3Location) {
    return
  }

  const { bucket, key } = s3Location
  const blobPath = `pending/hp/${Math.floor(game.replayID / 1000)}/${game.replayID}-${key}`
  let awsGetStream

  try {
    awsGetStream = s3.getObject({
      Bucket: bucket,
      Key: key,
      RequestPayer: 'requester'
    }).createReadStream()
  } catch (err) {
    if (err.statusCode === 403 || err.statusCode === 404) {
      // This probably means the file is not available, just skip it
      log(`skipping ${game.url}`)
      return
    }
  }

  log(`copying ${blobPath}`)
  const fileClient = rawFilesystem.getFileClient(blobPath)
  await fileClient.uploadStream(awsGetStream)
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const configFilesystem = datalake.getFileSystemClient(configContainer)
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  const s3 = await getS3()
  let mostRecent = await getMostRecent(configFilesystem)

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

          await copyReplayToAzure(rawFilesystem, s3, game, log)
          mostRecent = game.replayID
        }

        if (++count >= maxCount) {
          keepGoing = false
          break
        }
      }

      await saveMostRecent(configFilesystem, mostRecent)
    } else {
      keepGoing = false
    }
  }

  return count
}
