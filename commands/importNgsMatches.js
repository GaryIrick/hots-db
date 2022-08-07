const importNgsMatches = require('../src/importNgsMatches')

const run = async (maxCount) => {
  await importNgsMatches(maxCount, console.log)
}

if (process.argv.length !== 3) {
  console.log('Usage: importNgsMatches <maxCount>')
  process.exit(1)
}

run(Number(process.argv[2]))
