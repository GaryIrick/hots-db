const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const fastq = require('fastq')
const getCompressedJson = require('./lib/getCompressedJson')
const putCompressedJson = require('./lib/putCompressedJson')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, parsedContainer, sqlImportContainer, sparkImportContainer } }
} = require('./config')

const generateImports = async ({ parsedFilesystem, sqlImportFilesystem, sparkImportFilesystem, blobName, log }) => {
  log(`starting ${blobName}`)

  try {
    const parse = await getCompressedJson(parsedFilesystem, blobName)

    await putCompressedJson(sqlImportFilesystem, blobName, parse)
    // await putCompressedJson(sparkImportFilesystem, blobName, parse)
    // await moveBlob(parsedFilesystem, blobName, blobName.replace('pending/', 'processed/'))
    log(`generated imports for ${blobName}`)
  } catch (err) {
    await moveBlob(parsedFilesystem, blobName, blobName.replace('pending/', 'error/'))
    log(`error with ${blobName}`)
  }
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const parsedFilesystem = datalake.getFileSystemClient(parsedContainer)
  const sqlImportFilesystem = datalake.getFileSystemClient(sqlImportContainer)
  const sparkImportFilesystem = datalake.getFileSystemClient(sparkImportContainer)
  const queue = fastq.promise(generateImports, 20)

  let keepGoing = true
  let queuedWork = false
  let count = 0

  for await (const page of parsedFilesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 100 })) {
    if (!keepGoing) {
      break
    }

    for (const item of page.pathItems) {
      if (!keepGoing) {
        break
      }

      if (!item.isDirectory) {
        queue.push({ parsedFilesystem, sqlImportFilesystem, sparkImportFilesystem, blobName: item.name, log })
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
