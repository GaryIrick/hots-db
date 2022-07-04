const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const moveBlob = require('./lib/moveBlob')

const {
  azure: { storage: { account, rawContainer } }
} = require('./config')

let count = 0

const move = async (rawFilesystem, blobName, log) => {
  count++
  const parts = blobName.split('/')
  const newBlobName = `pending/hp/${parts[2].slice(0, 4)}/${parts[3]}`

  if (blobName !== newBlobName) {
    if (count % 1000 === 0) log(`moving ${blobName}`)
    await moveBlob(rawFilesystem, blobName, newBlobName)
  } else {
    if (count % 1000 === 0) log(`skipping ${blobName}`)
  }
}

module.exports = async (log) => {
  const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
  const rawFilesystem = datalake.getFileSystemClient(rawContainer)

  for await (const page of rawFilesystem.listPaths({ path: 'pending/hp/', recursive: true }).byPage({ maxPageSize: 100 })) {
    for (const p of page.pathItems) {
      if (!p.isDirectory) {
        await move(rawFilesystem, p.name, log)
      }
    }
  }

  console.log('trimming')

  // for await (const page of rawFilesystem.listPaths({ path: 'pending/hp/', recursive: true }).byPage({ maxPageSize: 100 })) {
  //   for (const p of page.pathItems) {
  //     if (p.isDirectory) {
  //       if (p.name.indexOf('/4') > 0 && p.name.split('/')[2].length === 5) {
  //         const directoryClient = rawFilesystem.getDirectoryClient(p.name)
  //         await directoryClient.delete()
  //       }
  //     }
  //   }
  // }

  return count
}
