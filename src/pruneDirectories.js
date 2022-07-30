const path = require('path')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')

const {
  azure: { storage: { account, rawContainer, parsedContainer, sqlImportContainer, sparkImportContainer } }
} = require('./config')

const prunePendingDirectory = async (datalake, containerName) => {
  const filesystem = datalake.getFileSystemClient(containerName)
  const emptyDirectories = {}

  for await (const page of filesystem.listPaths({ path: 'pending/', recursive: true }).byPage({ maxPageSize: 1000 })) {
    for (const item of page.pathItems) {
      if (item.name.match(/pending\/[a-z0-9-]+$/i)) {
        // Leave the first level under "pending" alone, even if it's empty.
        continue
      }

      if (item.isDirectory) {
        emptyDirectories[item.name] = 1
        console.log(`Checking ${containerName}:${item.name}`)
      } else {
        let parent = path.dirname(item.name)

        while (parent.includes('/')) {
          delete emptyDirectories[parent]
          parent = path.dirname(parent)
        }
      }
    }
  }

  // Walk backwards so child directories get removed before their parents.
  const directoriesToDelete = Object.keys(emptyDirectories).reverse()

  for (const directoryToDelete of directoriesToDelete) {
    const directoryClient = filesystem.getDirectoryClient(directoryToDelete)
    console.log(`Deleting ${containerName}:${directoryToDelete}`)
    await directoryClient.delete(false)
  }
}

module.exports = async (maxCount, log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())

  for (const containerName of [rawContainer, parsedContainer, sqlImportContainer, sparkImportContainer]) {
    await prunePendingDirectory(datalake, containerName)
  }
}
