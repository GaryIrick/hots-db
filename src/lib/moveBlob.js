const path = require('path')

module.exports = async (filesystem, sourceBlobName, destinationBlobName) => {
  const directoryClient = filesystem.getDirectoryClient(path.dirname(destinationBlobName))
  await directoryClient.createIfNotExists()
  const fileClient = filesystem.getFileClient(sourceBlobName)
  await fileClient.move(destinationBlobName)
}
