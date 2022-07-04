const { promisify } = require('util')
const { gzip } = require('zlib')

module.exports = async (filesystem, blobName, contents) => {
  const fileClient = filesystem.getFileClient(blobName)
  const compressed = await promisify(gzip)(Buffer.from(JSON.stringify(contents)))
  await fileClient.upload(compressed)
}
