const fs = require('fs')
const path = require('path')
const os = require('os')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { file: getTempFile } = require('tmp-promise')
const createWorkQueue = require('./lib/createWorkQueue')
const createThreadPool = require('./lib/createThreadPool')
const putCompressedJson = require('./lib/putCompressedJson')
const changeExtension = require('./lib/changeExtension')
const moveBlob = require('./lib/moveBlob')
const { cacheDirectory } = require('./config')

const {
  azure: { storage: { account, rawContainer, parsedContainer } }
} = require('./config')

const parseReplay = async ({ threadPool, rawFilesystem, parsedFilesystem, blobName, log }) => {
  log(`starting ${blobName}`)

  try {
    const { path: tempPath, cleanup } = await getTempFile()

    const cachedFilename = `${cacheDirectory}/replays/${blobName}`

    if (fs.existsSync(cachedFilename)) {
      fs.copyFileSync(cachedFilename, tempPath)
    } else {
      const rawFileClient = rawFilesystem.getFileClient(blobName)
      await rawFileClient.readToFile(tempPath)
    }

    const parse = await threadPool.runTask(tempPath, { replayFile: tempPath })

    if (parse.status === 1) {
      const parsedBlobName = changeExtension(blobName, 'parse.json.gz')
      await putCompressedJson(parsedFilesystem, parsedBlobName, parse)
      await moveBlob(rawFilesystem, blobName, blobName.replace('pending/', 'processed/'))
      log(`parsed ${blobName}`)
    } else {
      throw new Error(`Bad parse: status=${parse.status}`)
    }

    if (fs.existsSync(cachedFilename)) {
      fs.unlinkSync(cachedFilename)
    }

    await cleanup()
  } catch (err) {
    await moveBlob(rawFilesystem, blobName, blobName.replace('pending/', 'error/'))
    log(`error with ${blobName}: ${err}`)
  }
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  const parsedFilesystem = datalake.getFileSystemClient(parsedContainer)
  const threadPool = createThreadPool(os.cpus().length, path.join(__filename, '/../lib/parseWorker.js'))
  const queue = createWorkQueue(50, parseReplay)

  let keepGoing = true
  let count = 0

  for await (const page of rawFilesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 1000 })) {
    if (!keepGoing) {
      break
    }

    for (const item of page.pathItems) {
      if (!keepGoing) {
        break
      }

      if (!item.isDirectory) {
        queue.enqueue({ threadPool, rawFilesystem, parsedFilesystem, blobName: item.name, log })

        if (++count >= maxCount) {
          keepGoing = false
        }
      }
    }
  }

  await queue.drain()
  threadPool.shutdown()

  return count
}
