const { promisify } = require('util')
const { gunzip } = require('zlib')
const streamToBuffer = require('./streamToBuffer')

module.exports = async (filesystem, blobName) => {
  const fileClient = filesystem.getFileClient(blobName)
  const response = await fileClient.read()
  const contents = await streamToBuffer(response.readableStreamBody)
  const uncompressed = await promisify(gunzip)(contents)
  return JSON.parse(uncompressed)
}
