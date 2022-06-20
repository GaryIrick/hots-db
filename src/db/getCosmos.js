const { SecretClient } = require('@azure/keyvault-secrets')
const { CosmosClient } = require('@azure/cosmos')
const { DefaultAzureCredential } = require('@azure/identity')
const { azure: { keyVault, cosmos: { account, database, readOnlyKey, readWriteKey } } } = require('../config')

const containers = {}

module.exports = async (containerName, writable) => {
  const key = `${containerName}-${writable}`
  let container = containers[key]

  if (!container) {
    const vaultUrl = `https://${keyVault}.vault.azure.net`
    const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
    const secret = await secretClient.getSecret(writable ? readWriteKey : readOnlyKey)
    const endpoint = `https://${account}.documents.azure.com`
    const client = new CosmosClient({ endpoint, key: secret.value })
    const cosmosDb = client.database(database)
    container = cosmosDb.container(containerName)

    containers[key] = container
  }

  return container
}
