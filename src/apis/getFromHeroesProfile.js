const { DefaultAzureCredential } = require('@azure/identity')
const { SecretClient } = require('@azure/keyvault-secrets')
const agent = require('superagent')
const { azure: { keyVault }, heroesProfile: { apiUrl, secretName } } = require('../config')

let apiKey

module.exports = async (route, params) => {
  if (!apiKey) {
    const vaultUrl = `https://${keyVault}.vault.azure.net`
    const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
    const secret = await secretClient.getSecret(secretName)
    apiKey = secret.value
  }

  const url = `${apiUrl}/${route}`
  const get = agent
    .get(url)
    .query({ mode: 'json' })
    .query({ api_token: apiKey })

  if (params) {
    get.query(params)
  }

  return (await get).body
}
