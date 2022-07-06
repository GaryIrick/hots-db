const streamToBuffer = require('./streamToBuffer')

module.exports = async (filesystem, blobName) => {
  const fileClient = filesystem.getFileClient(blobName)
  const response = await fileClient.read()
  const contents = await streamToBuffer(response.readableStreamBody)
  return JSON.parse(contents)
}
