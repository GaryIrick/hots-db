const findNgsMatches = require('../src/findNgsMatches')

const run = async (season) => {
  const count = await findNgsMatches(season, console.log)
  console.log(`Found ${count} matches.`)
}

if (process.argv.length !== 3) {
  console.log('Usage: findNgsMatches <season#>')
  process.exit(1)
}

run(Number(process.argv[2]))
