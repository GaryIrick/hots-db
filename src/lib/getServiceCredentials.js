const { DefaultAzureCredential } = require('@azure/identity')

// E_NOTIMPL: There *has* to be a way to get the subscription ID when logged in via the CLI, right?
module.exports = () => {
  return {
    credentials: new DefaultAzureCredential(),
    subscriptionId: process.env.SUBSCRIPTION_ID
  }
}
