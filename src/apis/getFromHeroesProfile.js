const { DefaultAzureCredential } = require('@azure/identity')
const { SecretClient } = require('@azure/keyvault-secrets')
const delay = require('delay')
const agent = require('superagent')
const { azure: { keyVault }, heroesProfile: { apiUrl, secretName } } = require('../config')

let apiKey

module.exports = async (route, params, binary) => {
  if (!apiKey) {
    const vaultUrl = `https://${keyVault}.vault.azure.net`
    const secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential())
    const secret = await secretClient.getSecret(secretName)
    apiKey = secret.value
  }

  const url = `${apiUrl}/${route}`

  while (true) {
    // A superagent request can only be sent once, so build a new one for each attempt.
    const get = agent
      .get(url)
      .set('Authorization', `Bearer ${apiKey}`)

    if (params) {
      get.query(params)
    }

    if (binary) {
      get.responseType('blob')
    }

    try {
      return (await get).body
    } catch (e) {
      if (e.status === 429) {
        const seconds = Number(e.response.headers['retry-after']) || 1
        console.log(`Got 429 from Heroes Profile, pausing for ${seconds} s.`)
        await delay(seconds * 1000)
      } else {
        throw e
      }
    }
  }
}
