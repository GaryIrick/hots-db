const attachNgsMatches = require('../src/attachNgsMatches')

const run = async (maxCount) => {
  await attachNgsMatches(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: attachNgsMatches <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
