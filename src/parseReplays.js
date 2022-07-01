const path = require('path')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const { file: getTempFile } = require('tmp-promise')
const parser = require('hots-parser')
const {
  azure: { storage: { account, rawContainer, parsedContainer } }
} = require('./config')

const parseReplay = async (rawFilesystem, parsedFilesystem, blobName) => {
  const rawFileClient = rawFilesystem.getFileClient(blobName)
  const processedBlobName = blobName.replace('pending/', 'processed/')
  const parsedBlobName = blobName.replace(path.extname(blobName), '.json')
  const { path: tempPath, cleanup } = await getTempFile()
  await rawFileClient.readToFile(tempPath)
  const parse = parser.processReplay(tempPath, { getBMData: false, overrideVerifiedBuild: true })
  const json = JSON.stringify(parse)
  const parsedFileClient = parsedFilesystem.getFileClient(parsedBlobName)
  await parsedFileClient.upload(Buffer.from(json))
  const rawDirectoryClient = rawFilesystem.getDirectoryClient(path.dirname(processedBlobName))
  await rawDirectoryClient.createIfNotExists()
  await rawFileClient.move(processedBlobName)
  await cleanup()
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)
  const parsedFilesystem = datalake.getFileSystemClient(parsedContainer)

  let count = 0

  for await (const p of rawFilesystem.listPaths({ path: 'pending/', recursive: true })) {
    if (!p.isDirectory) {
      log(`parsing ${p.name}`)
      await parseReplay(rawFilesystem, parsedFilesystem, p.name)

      if (++count >= maxCount) {
        return count
      }
    }
  }

  return count
}
