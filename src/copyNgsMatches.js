const { SecretClient } = require('@azure/keyvault-secrets')
const { BlobServiceClient } = require('@azure/storage-blob')
const { DefaultAzureCredential } = require('@azure/identity')
const AWS = require('aws-sdk')
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
  try {
    const s3 = await getS3()
    const getStream = s3.getObject({
      Bucket: bucket,
      Key: key,
      RequestPayer: 'requester'
    }).createReadStream()

    await blobClient.uploadStream(getStream)
  } catch (e) {
    // If this file is missing, we just move own with our lives.
    if (e.statusCode === 403 || e.statusCode === 404) {
      log(`Skipping ${key}, it appears to be unavailable.`)
    } else {
      throw e;
    }
  }
}

const copyReplay = async (season, key, log) => {
  const path = `pending/ngs/season-${season}/${key}`
  const blobClient = await getBlobClient(path)

  if (!await doesFileExistInAzure(blobClient)) {
    await copyFileFromS3ToAzure(bucket, key, blobClient, log)
  }
}

// E_NOTIMPL: Maybe pass this in?
const maxCount = 100

module.exports = async (log) => {
  const container = await getCosmos(matchesContainer, true)
  let count = 0
  let keepGoing = true

  const query = container.items.query('SELECT m.id, m.season, m.games FROM m WHERE m.isCopied = false')

  while (keepGoing) {
    const response = await query.fetchNext()

    for (const match of response.resources) {
      if (count >= maxCount) {
        break
      }

      const copies = match.games.map(key => copyReplay(match.season, key, log))
      await Promise.all(copies)

      await container.item(match.id, match.id).patch([
        { op: 'set', path: '/isCopied', value: true },
        { op: 'set', path: '/isParsed', value: false }
      ])

      log(`Copied match ${match.id}.`)

      count++
    }

    keepGoing = count < maxCount && response.hasMoreResults
  }

  log(`Copied ${count} matches.`)

  return count
}
