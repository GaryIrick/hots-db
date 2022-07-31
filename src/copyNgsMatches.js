// E_NOTIMPL: Convert to use FileSystemClient, maybe.
const { SecretClient } = require('@azure/keyvault-secrets')
const { BlobServiceClient } = require('@azure/storage-blob')
const { DefaultAzureCredential } = require('@azure/identity')
const AWS = require('aws-sdk')
const createWorkQueue = require('./lib/createWorkQueue')
const streamToBuffer = require('./lib/streamToBuffer')
const getCosmos = require('./db/getCosmos')
const {
  ngs: { bucket },
  azure: { keyVault, cosmos: { matchesContainer }, storage: { account, rawContainer } },
  aws: { credentialsSecretName }
} = require('./config')

let s3
let containerClient

const getS3 = async () => {
  if (!s3) {
    const vaultUrl = `https://${keyVault}.vault.azure.net`
    const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
    const secret = await secretClient.getSecret(credentialsSecretName)
    const creds = JSON.parse(secret.value)
    AWS.config.credentials = new AWS.Credentials(creds.accessKeyId, creds.secretAccessKey)
    s3 = new AWS.S3()
  }

  return s3
}

const getBlobClient = async (path) => {
  if (!containerClient) {
    const blobServiceClient = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential())
    containerClient = blobServiceClient.getContainerClient(rawContainer)
  }

  return containerClient.getBlockBlobClient(path)
}

const doesFileExistInAzure = async (blobClient) => {
  try {
    await blobClient.getProperties()
  } catch (err) {
    if (err.statusCode === 404) {
      return false
    } else {
      throw err
    }
  }
}

const copyFileFromS3ToAzure = async (bucket, key, blobClient, log) => {
  let replay

  try {
    const s3 = await getS3()
    const awsGetStream = s3.getObject({
      Bucket: bucket,
      Key: key,
      RequestPayer: 'requester'
    })
      .createReadStream()

    replay = await streamToBuffer(awsGetStream)
  } catch (err) {
    // If this file is missing, we just move own with our lives.
    if (err.statusCode === 403 || err.statusCode === 404) {
      log(`Skipping ${key}, it appears to be unavailable.`)
      return
    } else {
      throw err
    }
  }
  await blobClient.upload(replay, replay.length)
}

const copyReplay = async (season, key, log) => {
  const path = `pending/ngs/season-${season}/${key}`
  const blobClient = await getBlobClient(path)

  if (!await doesFileExistInAzure(blobClient)) {
    await copyFileFromS3ToAzure(bucket, key, blobClient, log)
  }
}

const copyMatch = async ({ container, match, log }) => {
  for (const game of match.games) {
    await copyReplay(match.season, game.replayKey, log)
  }

  await container.item(match.id, match.id).patch([
    { op: 'set', path: '/status/isCopied', value: true }
  ])

  log(`Copied match ${match.id}.`)
}

module.exports = async (maxCount, log) => {
  const container = await getCosmos(matchesContainer, true)
  const queue = createWorkQueue(25, copyMatch)
  let count = 0
  let keepGoing = true

  const query = container.items.query('SELECT m.id, m.season, m.games FROM m WHERE (m.status.isCopied = false OR NOT ISDEFINED(m.status.isCopied))')

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const match of response.resources) {
      if (count >= maxCount) {
        break
      }

      if (count === 0) {
        // Wait on the very first one.  This makes sure our credentials are good before we
        // starting running several of them.  If we don't do this, we can get 429 as
        // multiple tasks race to get the credential before it's cached.
        await copyMatch({ container, match, log })
      } else {
        queue.enqueue({ container, match, log })
      }

      count++
    }

    keepGoing = count < maxCount && response.hasMoreResults
  }

  await queue.drain()

  log(`Copied ${count} matches.`)

  return count
}
