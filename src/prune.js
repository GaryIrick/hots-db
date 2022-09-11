const path = require('path')
const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')

const {
  azure: { storage: { account, daysToRetainReplays, rawContainer, parsedContainer, sqlImportContainer, sparkImportContainer } }
} = require('./config')

const pruneEmptyDirectories = async (datalake, containerName, topLevelDirectory, log) => {
  log(`Pruning empty directories in ${containerName}:${topLevelDirectory}.`)
  const filesystem = datalake.getFileSystemClient(containerName)
  const emptyDirectories = {}
  let stop = false

  for await (const page of filesystem.listPaths({ path: `${topLevelDirectory}/`, recursive: true }).byPage({ maxPageSize: 1000 })) {
    if (stop) {
      break
    }

    for (const item of page.pathItems) {
      if (item.isDirectory) {
        emptyDirectories[item.name] = 1
      } else {
        let parent = path.dirname(item.name)

        while (parent.includes('/')) {
          delete emptyDirectories[parent]
          parent = path.dirname(parent)
        }

        // We always walk the data oldest-to-newest and depth-first, so we can stop when
        // we find a directory that's not empty.
        stop = true
        break
      }
    }
  }

  // Walk backwards so child directories get removed before their parents.
  const directoriesToDelete = Object.keys(emptyDirectories).reverse()

  let count = 0

  for (const directoryToDelete of directoriesToDelete) {
    const directoryClient = filesystem.getDirectoryClient(directoryToDelete)
    log(`Deleting directory ${containerName}:${directoryToDelete}`)
    await directoryClient.delete(false)
    count++
  }

  return count
}

const pruneOldFiles = async (datalake, containerName, topLevelDirectory, log) => {
  log(`Pruning old files in ${containerName}:${topLevelDirectory}.`)
  const filesystem = datalake.getFileSystemClient(containerName)
  const filesToDelete = []
  let stop = false
  const now = new Date()

  for await (const page of filesystem.listPaths({ path: `${topLevelDirectory}/`, recursive: true }).byPage({ maxPageSize: 1000 })) {
    if (stop) {
      break
    }

    for (const item of page.pathItems) {
      if (!item.isDirectory) {
        const ageInDays = (now - item.lastModified) / 1000 / 60 / 60 / 24

        if (ageInDays > daysToRetainReplays) {
          filesToDelete.push(item.name)
        } else {
          // We always walk the data oldest-to-newest and depth-first, so we can stop when
          // we find a file that's not old.
          stop = true
          break
        }
      }
    }
  }

  let count = 0

  for (const fileToDelete of filesToDelete) {
    const fileClient = filesystem.getFileClient(fileToDelete)
    log(`Deleting file ${containerName}:${fileToDelete}`)
    await fileClient.delete(false)
    count++
  }

  return count
}

module.exports = async (log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  let directoryCount = 0

  const fileCount = await pruneOldFiles(datalake, rawContainer, 'processed/hp', log)
  directoryCount = directoryCount + await pruneEmptyDirectories(datalake, rawContainer, 'processed/hp', log)

  for (const containerName of [rawContainer, parsedContainer, sqlImportContainer, sparkImportContainer]) {
    directoryCount = directoryCount + await pruneEmptyDirectories(datalake, containerName, 'pending/hp', log)
    directoryCount = directoryCount + await pruneEmptyDirectories(datalake, containerName, 'pending/ngs', log)
  }

  return directoryCount + fileCount
}
