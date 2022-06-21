const copyNgsMatches = require('../src/copyNgsMatches')

const run = async () => {
  const count = await copyNgsMatches(console.log)
  console.log(`Copied ${count} matches.`)
}

run()
