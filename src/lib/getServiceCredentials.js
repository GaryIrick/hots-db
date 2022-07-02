const { DefaultAzureCredential } = require('@azure/identity')

module.exports = () => {
  return {
    credentials: new DefaultAzureCredential(),
    subscriptionId: process.env.SUBSCRIPTION_ID
  }
}
