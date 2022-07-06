module.exports = async (filesystem, blobName, contents) => {
  const fileClient = filesystem.getFileClient(blobName)
  await fileClient.upload(Buffer.from(JSON.stringify(contents)))
}
