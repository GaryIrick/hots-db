const fs = require('fs')
const { promisify } = require('util')
const { gunzip } = require('zlib')
const streamToBuffer = require('./streamToBuffer')
const { cacheDirectory } = require('../config')

module.exports = async (filesystem, blobName) => {
  const cachedFilename = `${cacheDirectory}/${filesystem.name}/${blobName}`

  if (fs.existsSync(cachedFilename)) {
    return JSON.parse(fs.readFileSync(cachedFilename))
  }

  const fileClient = filesystem.getFileClient(blobName)
  const response = await fileClient.read()
  const contents = await streamToBuffer(response.readableStreamBody)
  const uncompressed = await promisify(gunzip)(contents)
  return JSON.parse(uncompressed)
}
