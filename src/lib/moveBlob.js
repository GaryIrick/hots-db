const fs = require('fs')
const path = require('path')
const { cacheDirectory } = require('../config')

module.exports = async (filesystem, sourceBlobName, destinationBlobName) => {
  const directoryClient = filesystem.getDirectoryClient(path.dirname(destinationBlobName))
  await directoryClient.createIfNotExists()
  const fileClient = filesystem.getFileClient(sourceBlobName)
  await fileClient.move(destinationBlobName)

  const cachedFilename = `${cacheDirectory}/${filesystem.name}/${sourceBlobName}`

  if (fs.existsSync(cachedFilename)) {
    fs.unlinkSync(cachedFilename)
  }
}
