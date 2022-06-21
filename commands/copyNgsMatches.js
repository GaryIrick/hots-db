const copyNgsMatches = require('../src/copyNgsMatches')

const run = async () => {
  await copyNgsMatches(console.log)
}

run()
