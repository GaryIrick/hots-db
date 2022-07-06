const copyNgsMatches = require('../src/copyNgsMatches')

const run = async (maxCount) => {
  await copyNgsMatches(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: copyNgsMatches <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
