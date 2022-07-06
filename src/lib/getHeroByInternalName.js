const { DataLakeServiceClient } = require('@azure/storage-file-datalake')
const { DefaultAzureCredential } = require('@azure/identity')
const getUncompressedJson = require('./getUncompressedJson')

const {
  azure: { storage: { account, configContainer } }
} = require('../config')

let heroMap

module.exports = async (internalName) => {
  if (!heroMap) {
    const datalake = new DataLakeServiceClient(`https://${account}.dfs.core.windows.net`, new DefaultAzureCredential())
    const configFilesystem = datalake.getFileSystemClient(configContainer)
    const heroes = await getUncompressedJson(configFilesystem, 'heroes.json')
    heroMap = {}

    for (const hero of heroes) {
      heroMap[hero.internalName] = hero.name
    }
  }

  if (!heroMap[internalName]) {
    throw new Error(`Unable to find hero with internal name ${internalName}.`)
  }

  return heroMap[internalName]
}
