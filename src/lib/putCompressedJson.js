const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { gzip } = require('zlib')
const { cacheDirectory } = require('../config')

module.exports = async (filesystem, blobName, contents) => {
  const data = Buffer.from(JSON.stringify(contents))
  const fileClient = filesystem.getFileClient(blobName)
  const compressed = await promisify(gzip)(data)
  await fileClient.upload(compressed)

  const cachedFilename = `${cacheDirectory}/${filesystem.name}/${blobName}`
  fs.mkdirSync(path.dirname(cachedFilename), { recursive: true })
  fs.writeFileSync(cachedFilename, data)
}
