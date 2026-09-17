const getPlayerPrivacyChanges = require('../src/getPlayerPrivacyChanges')

const run = async () => {
  const count = await getPlayerPrivacyChanges(console.log)
  console.log(`Found ${count} privacy changes.`)
}

run()
