const { DefaultAzureCredential } = require('@azure/identity')
const { SecretClient } = require('@azure/keyvault-secrets')
const delay = require('delay')
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

  try {
    return (await get).body
  } catch (e) {
    if (e.statusCode === 429) {
      console.log('Got 429 from Heroes Profile, pausing for 550 ms.')
      await delay(500)
      return (await get).body
    } else {
      throw e
    }
  }
}
