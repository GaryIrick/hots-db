const pullReplaysForDivision = require('../src/pullReplaysForDivision')

const run = async (season, division) => {
  const count = await pullReplaysForDivision(season, division, console.log)
  console.log(`Found ${count} replays.`)
}

if (process.argv.length !== 4) {
  console.log('Usage: findNgsMatches <season>, <division>')
  process.exit(1)
}

run(Number(process.argv[2]), process.argv[3])
