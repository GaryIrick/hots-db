const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { file: getTempFile } = require('tmp-promise')
const fastq = require('fastq')
const parser = require('hots-parser')
const putCompressedJson = require('./lib/putCompressedJson')
const changeExtension = require('./lib/changeExtension')
const addAdditionalParseInfo = require('./lib/addAdditionalParseInfo')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, rawContainer, parsedContainer } }
} = require('./config')

const parseReplay = async ({ rawFilesystem, parsedFilesystem, blobName, log }) => {
  log(`starting ${blobName}`)

  try {
    const rawFileClient = rawFilesystem.getFileClient(blobName)
    const { path: tempPath, cleanup } = await getTempFile()
    await rawFileClient.readToFile(tempPath)
    const parse = parser.processReplay(tempPath, { getBMData: false, overrideVerifiedBuild: true })

    if (parse.status === 1) {
      addAdditionalParseInfo(tempPath, parse)
      const parsedBlobName = changeExtension(blobName, 'parse.json.gz')
      await putCompressedJson(parsedFilesystem, parsedBlobName, parse)
      await moveBlob(rawFilesystem, blobName, blobName.replace('pending/', 'processed/'))
      log(`parsed ${blobName}`)
    } else {
      throw new Error(`Bad parse: status=${parse.status}`)
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
  const queue = fastq.promise(parseReplay, 20)

  let keepGoing = true
  let queuedWork = false
  let count = 0

  for await (const page of rawFilesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 100 })) {
    if (!keepGoing) {
      break
    }

    for (const item of page.pathItems) {
      if (!keepGoing) {
        break
      }

      if (!item.isDirectory) {
        queue.push({ rawFilesystem, parsedFilesystem, blobName: item.name, log })
        queuedWork = true

        if (++count >= maxCount) {
          keepGoing = false
        }
      }
    }
  }

  if (queuedWork) {
    // If we do this when we haven't put anything into the queue, the process stops immediately.
    // I have no idea why.
    await queue.drained()
  }

  return count
}
